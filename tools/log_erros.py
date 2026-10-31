"""Per-section detail of selected election-day log errors, with what the log records right after each one.

Usage: python -I tools/log_erros.py <zip> [<zip> ...]   -> data/log_erros/<UF>.json
"""
import json
import re
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from urna_audit import ELECTION_DAY, log_texts, open_zip  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "log_erros"
ALVOS = {
    "voto_nao_registrado": "O voto do eleitor NÃO foi registrado",
    "assinatura": re.compile(r"assinatura|integridade do sistema", re.I),
}
DEPOIS = 25  # log lines kept after each error


def section(args):
    zip_path, prefix = args
    z, _ = open_zip(zip_path)
    achados = []
    for text in log_texts(z.read(prefix + "log.jez")):
        linhas = [l for l in text.splitlines() if l.startswith(ELECTION_DAY)]
        for i, l in enumerate(linhas):
            p = l.split("\t")
            if len(p) < 5 or p[1] != "ERRO":
                continue
            for nome, alvo in ALVOS.items():
                if (alvo in p[4]) if isinstance(alvo, str) else alvo.search(p[4]):
                    seguinte = [x.split("\t")[0][11:] + " " + x.split("\t")[4][:90] for x in linhas[i + 1:i + 1 + DEPOIS]
                                if len(x.split("\t")) > 4]
                    achados.append({"tipo": nome, "hora": p[0][11:], "urna": p[2], "evento": p[4][:200], "depois": seguinte})
    return prefix, achados


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for path in sys.argv[1:]:
        uf = re.search(r"_2t_([A-Z]{2})\.zip$", path).group(1)
        z, names = open_zip(path)
        prefixes = sorted(n[:-7] for n in names if n.endswith("-log.jez"))
        res = {}
        with ProcessPoolExecutor(14) as pool:
            for prefix, achados in pool.map(section, [(path, p) for p in prefixes], chunksize=64):
                if achados:
                    res[prefix] = achados
        (OUT / f"{uf}.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
        print(uf, len(res), "secoes com erro", sum(len(v) for v in res.values()), "erros", flush=True)


if __name__ == "__main__":
    sys.exit(main())
