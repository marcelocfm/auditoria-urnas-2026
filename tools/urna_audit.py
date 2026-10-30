"""Audit every second-round ballot box from the raw TSE files (signed BU, RDV, printed BU image, log).

For each section it:
  * recounts the RDV (one record per vote) and compares with the signed BU, per office;
  * compares the BU with the printed BU image (imgbu) for President;
  * checks that bu/rdv/imgbu/log match the SHA-512 hashes inside the urna's signature container;
  * reads the urna log: votes computed on election day per local hour, error/alert counts.

Usage: python -I tools/urna_audit.py <zip> [<zip> ...]   -> data/urna_audit/<UF>.parquet + <UF>_log.json
"""
import collections
import hashlib
import io
import json
import re
import sys
import zipfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import asn1tools
import pyarrow as pa
import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).resolve().parent))
import der  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "urna_audit"
SIG = asn1tools.compile_files([str(ROOT / "spec2026" / "assinatura.asn1")], codec="ber", numeric_enums=True)
ELECTION_DAY = "25/10/2026"
PRESIDENTE = 1

BU_TIPO = {1: "nominal", 2: "branco", 3: "nulo", 4: "legenda", 5: "sem_candidato"}
RDV_TIPO = {1: "legenda", 2: "nominal", 3: "branco", 4: "nulo", 5: "branco", 6: "nulo", 7: "nulo", 8: "nulo", 9: "nulo"}
DIGITS = re.compile(r"\d+")


def children(node):
    return node[2]


def find_results(bu):
    """The vote totals: a SEQUENCE OF per-election SEQUENCEs whose first element is the election id."""
    for tag, cons, val in bu[6:]:
        if tag == 0x30 and cons and val and val[0][0] == 0x30 and val[0][1] and val[0][2][0][0] == 0x02 \
                and len(val[0][2]) >= 5:
            return val
    raise ValueError("BU sem bloco de resultados")


def parse_bu(data):
    env = children(der.parse(data)[0])
    ident = children(env[2])
    mun, zona = (der.integer(x[2]) for x in children(ident[0]))
    bu = children(der.parse(next(v for t, c, v in env if t == 0x04))[0])
    urna = children(bu[2])
    carga = children(children(urna[2])[1])
    datas = [v.decode() for t, c, v in children(bu[5]) if not c and t == 0x1B] if bu[5][1] else []
    out = {
        "municipio": mun, "zona": zona, "secao": der.integer(ident[2][2]),
        "tipo_urna": der.integer(urna[0][2]), "versao": urna[1][2].decode("latin-1"),
        "tipo_arquivo": der.integer(urna[3][2]), "urna_bu": der.integer(carga[0][2]),
        "dt_carga": next((v.decode() for t, c, v in carga if t == 0x1B and len(v) == 15), None),
        "dt_emissao": bu[4][2].decode() if bu[4][0] == 0x1B else None,
        "dt_abertura": datas[0] if len(datas) > 0 else None,
        "dt_encerramento": datas[1] if len(datas) > 1 else None,
        "votos": collections.Counter(),
    }
    for eleicao in find_results(bu):
        for res in children(eleicao):
            if res[0] != 0x30 or not res[1]:
                continue
            for res_cargo in children(res):
                lista = next(n for n in children(res_cargo) if n[0] == 0x30 and n[1])
                for total in children(lista):
                    t = children(total)
                    cargo = der.integer(t[0][2])
                    votaveis = next(n for n in t if n[0] == 0x30 and n[1])
                    for v in children(votaveis):
                        f = {tag: val for tag, cons, val in children(v)}
                        tipo = BU_TIPO.get(der.integer(f[0x81]), "outro")
                        codigo = der.integer(children((0xA3, True, f[0xA3]))[1][2]) if 0xA3 in f else None
                        out["votos"][(cargo, tipo, codigo if tipo == "nominal" else None)] += der.integer(f[0x82])
    return out


def parse_rdv(data):
    content = children(children(der.parse(data)[0])[2])
    eleicoes = content[-1]
    votos = collections.Counter()
    for eleicao in children(eleicoes):
        e = children(eleicao)
        cargos = next(n for n in e if n[0] == 0x30 and n[1])
        for cargo_node in children(cargos):
            c = children(cargo_node)
            cargo = der.integer(c[0][2])
            lista = next(n for n in c if n[0] == 0x30 and n[1])
            for voto in children(lista):
                f = children(voto)
                tipo = RDV_TIPO.get(der.integer(f[0][2]), "outro")
                digit = f[1][2].decode() if len(f) > 1 and tipo == "nominal" else None
                votos[(cargo, tipo, int(digit) if digit else None)] += 1
    return votos


def parse_imgbu(data):
    """President block of the printed BU: {candidate number: votes, 'branco':, 'nulo':}."""
    text = data.decode("latin-1")
    start = text.find("PRESIDENTE-")
    if start < 0:
        return None
    end = text.find("=====", start)
    block = text[start:end if end > start else start + 1500]
    out = {}
    for name, num, qtd in re.findall(r"(?m)^  (\S.*?)\s{2,}(\d{1,5})\s+(\d{4})$", block):
        out[int(num)] = int(qtd)
    for label, key in (("Brancos", "branco"), ("Nulos", "nulo")):
        m = re.search(label + r"\s+(\d{4})", block)
        if m:
            out[key] = int(m.group(1))
    return out


def check_signatures(z, names, vsc):
    """Hash checks: returns (files checked, files ok, self-hash ok, urna model)."""
    top = children(der.parse(vsc)[0])
    checked = ok = 0
    self_ok = True
    for ent in top[:2]:
        e = children(ent)
        auto = children(e[2])
        conteudo = e[3][2]
        assinatura = children(auto[3])
        self_ok &= hashlib.sha512(conteudo).digest() == assinatura[1][2]
        for arq in SIG.decode("Assinatura", conteudo)["arquivosAssinados"]:
            # only bu/rdv/imgbu/log are published; biometrics and voter-attendance files are withheld by the TSE
            if arq["nomeArquivo"] in names:
                checked += 1
                ok += hashlib.sha512(z.read(arq["nomeArquivo"])).digest() == arq["assinatura"]["hash"]
    modelo = der.integer(children(top[2])[0][2]) if len(top) > 2 else None
    return checked, ok, self_ok, modelo


def log_texts(data):
    """A replacement urna's log.jez nests the original urna's archived log (*.jez) next to its own logd.dat."""
    inner = zipfile.ZipFile(io.BytesIO(data))
    for name in inner.namelist():
        content = inner.read(name)
        if name.endswith(".jez"):
            yield from log_texts(content)
        else:
            yield content.decode("latin-1")


def parse_log(data):
    """Votes computed on election day by local hour, plus counts of non-INFO events (by template)."""
    por_hora = [0] * 24
    eventos = collections.Counter()
    urnas = set()
    for text in log_texts(data):
        for line in text.splitlines():
            p = line.split("\t")
            if len(p) < 5 or not p[0].startswith(ELECTION_DAY):
                continue
            urnas.add(p[2])
            if p[4] == "O voto do eleitor foi computado":
                por_hora[int(p[0][11:13])] += 1
            if p[1] != "INFO":
                eventos[f"{p[1]}|{p[3]}|{DIGITS.sub('#', p[4])[:120]}"] += 1
    return por_hora, eventos, urnas


_ZIPS = {}


def open_zip(path):
    """One ZipFile per worker process: re-reading the central directory of a 400k-entry zip per section is slow."""
    if path not in _ZIPS:
        z = zipfile.ZipFile(path)
        _ZIPS[path] = (z, set(z.namelist()))
    return _ZIPS[path]


def audit_section(args):
    zip_path, prefix = args
    row = {"prefixo": prefix, "erro": None}
    try:
        z, names = open_zip(zip_path)
        bu = parse_bu(z.read(prefix + "bu.dat"))
        row.update({k: v for k, v in bu.items() if k != "votos"})
        pres_bu = {k: v for k, v in bu["votos"].items() if k[0] == PRESIDENTE}
        row["bu_lula"] = pres_bu.get((1, "nominal", 13), 0)
        row["bu_flavio"] = pres_bu.get((1, "nominal", 22), 0)
        row["bu_branco"] = pres_bu.get((1, "branco", None), 0)
        row["bu_nulo"] = pres_bu.get((1, "nulo", None), 0)
        row["bu_total"] = sum(pres_bu.values())

        if prefix + "rdv.dat" in names:
            rdv = parse_rdv(z.read(prefix + "rdv.dat"))
            # BU counts invalid typed numbers as null; RDV keeps the digits, so compare by category
            def norm(counter, valid):
                out = collections.Counter()
                for (cargo, tipo, cod), n in counter.items():
                    if tipo == "nominal" and cod not in valid.get(cargo, set()):
                        tipo, cod = "nulo", None
                    out[(cargo, tipo, cod)] += n
                return out
            valid = collections.defaultdict(set)
            for (cargo, tipo, cod) in bu["votos"]:
                if tipo == "nominal":
                    valid[cargo].add(cod)
            diff = norm(rdv, valid)
            diff.subtract(bu["votos"])
            bad = {k: v for k, v in diff.items() if v}
            row["rdv_total"] = sum(v for k, v in rdv.items() if k[0] == PRESIDENTE)
            row["rdv_lula"] = rdv.get((1, "nominal", 13), 0)
            row["rdv_flavio"] = rdv.get((1, "nominal", 22), 0)
            row["rdv_cargos_divergentes"] = len({k[0] for k in bad})
            row["rdv_divergencia"] = json.dumps({f"{k[0]}|{k[1]}|{k[2]}": v for k, v in bad.items()}) if bad else None
        if prefix + "imgbu.dat" in names:
            img = parse_imgbu(z.read(prefix + "imgbu.dat"))
            if img is not None:
                row["img_lula"] = img.get(13, 0)
                row["img_flavio"] = img.get(22, 0)
                row["img_confere"] = (img.get(13, 0), img.get(22, 0), img.get("branco", 0), img.get("nulo", 0)) == \
                    (row["bu_lula"], row["bu_flavio"], row["bu_branco"], row["bu_nulo"])
        vsc = next((prefix + s for s in ("vota.vsc", "red.vsc", "sa.vsc") if prefix + s in names), None)
        row["assinatura_arquivo"] = vsc.rsplit("-", 1)[1] if vsc else None
        if vsc:
            checked, ok, self_ok, modelo = check_signatures(z, names, z.read(vsc))
            row.update(hash_arquivos=checked, hash_ok=ok, hash_auto_ok=self_ok, modelo_urna=modelo)
        if prefix + "log.jez" in names:
            por_hora, eventos, urnas = parse_log(z.read(prefix + "log.jez"))
            row["log_votos"] = sum(por_hora)
            row["log_votos_hora"] = por_hora
            row["log_urnas"] = ",".join(sorted(urnas))
            row["_eventos"] = eventos
    except Exception as e:  # keep going; failures are reported per section
        row["erro"] = f"{type(e).__name__}: {e}"[:300]
    return row


def run(zip_path):
    zip_path = Path(zip_path)
    uf = re.search(r"_2t_([A-Z]{2})\.zip$", zip_path.name).group(1)
    out = OUT / f"{uf}.parquet"
    if out.exists():
        print(f"{uf}: cached", flush=True)
        return
    with zipfile.ZipFile(zip_path) as z:
        prefixes = sorted({n.rsplit("-", 1)[0] + "-" for n in z.namelist() if n.endswith("-bu.dat")})
    eventos = collections.Counter()
    rows = []
    with ProcessPoolExecutor(14) as pool:
        for row in pool.map(audit_section, [(str(zip_path), p) for p in prefixes], chunksize=64):
            eventos.update(row.pop("_eventos", {}))
            rows.append(row)
    for r in rows:
        r["uf"] = uf
    pq.write_table(pa.Table.from_pylist(rows), out)
    (OUT / f"{uf}_log.json").write_text(json.dumps(eventos.most_common(), ensure_ascii=False), encoding="utf-8")
    erros = sum(1 for r in rows if r["erro"])
    print(f"{uf}: {len(rows)} secoes, {erros} erros de leitura", flush=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for path in sys.argv[1:]:
        run(path)
