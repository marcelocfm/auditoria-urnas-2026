"""Hour-by-hour log detail for selected stations: poll-worker releases (sections where one worker released 100+
voters) and votes, plus every non-routine event after 5 pm for stations that closed late.

Usage: python -I tools/secoes_alvo.py <zip> [<zip> ...]   -> data/secoes_alvo/<UF>.json
"""
import collections
import json
import re
import sys
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parent))
from urna_audit import ELECTION_DAY, log_texts, open_zip  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "secoes_alvo"
LIBEROU = re.compile(r"^Mesário (\d+) habilitou o eleitor$")
ROTINA = ("Aguardando", "Tecla", "Solicita", "Capturada", "Foto", "Voto confirmado", "Identificador", "Tipo de hab",
          "Número de tent", "Eleitor foi", "O voto do", "Espaço", "Quantidade de memória", "Urna ligada conectada",
          "Verificação de assinatura - Etapa")


def alvos(uf):
    con = duckdb.connect()
    mes = [r[0] for r in con.sql(f"""SELECT prefixo FROM read_parquet('{(ROOT / "data" / "mesario" / "*.parquet").as_posix()}')
                                    WHERE uf = '{uf}' AND max_por_mesario >= 100""").fetchall()]
    tarde = [r[0] for r in con.sql(f"""SELECT prefixo FROM read_parquet('{(ROOT / "data" / "urna_audit" / "*.parquet").as_posix()}',
                                      union_by_name = true)
                                      WHERE uf = '{uf}' AND dt_encerramento >= '20261025T200000'""").fetchall()]
    return mes, tarde


def detalhe(z, prefix, tarde):
    linhas = []
    for text in log_texts(z.read(prefix + "log.jez")):
        linhas += [l.split("\t") for l in text.splitlines() if l.startswith(ELECTION_DAY)]
    linhas = sorted((l for l in linhas if len(l) > 4), key=lambda l: l[0])
    liberacoes = collections.Counter()
    votos = [0] * 24
    for l in linhas:
        h = int(l[0][11:13])
        if LIBEROU.match(l[4]):
            liberacoes[h] += 1
        elif l[4] == "O voto do eleitor foi computado":
            votos[h] += 1
    out = {"liberacoes_por_hora": [liberacoes[h] for h in range(24)], "votos_por_hora": votos}
    if tarde:
        # titles typed by poll workers are personal data: drop those lines
        out["eventos_apos_17h"] = [f"{l[0][11:]} {l[1]} {l[4][:120]}" for l in linhas
                                   if l[0][11:13] >= "17" and not l[4].startswith(ROTINA) and "Título" not in l[4]]
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for path in sys.argv[1:]:
        uf = re.search(r"_2t_([A-Z]{2})\.zip$", path).group(1)
        mes, tarde = alvos(uf)
        z, names = open_zip(path)
        res = {p: detalhe(z, p, p in tarde) for p in mes + tarde if p + "log.jez" in names}
        (OUT / f"{uf}.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
        print(uf, len(mes), "secoes mesario 100+,", len(tarde), "fechadas apos 20h", flush=True)


if __name__ == "__main__":
    sys.exit(main())
