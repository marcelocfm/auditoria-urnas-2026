"""President votes per state, both rounds (sum of every BU) -> site/public/data/estados.json for the state chart."""
import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
BU = (ROOT / "data" / "parquet" / "bu" / "*.parquet").as_posix()
OUT = ROOT / "site" / "public" / "data" / "estados.json"


def main():
    con = duckdb.connect()
    cur = con.execute(f"""
        SELECT turno, uf,
               sum(votos) FILTER (WHERE cd_tipo_votavel = 1 AND nr_votavel = 13) lula,
               sum(votos) FILTER (WHERE cd_tipo_votavel = 1 AND nr_votavel = 22) flavio,
               coalesce(sum(votos) FILTER (WHERE cd_tipo_votavel = 1 AND nr_votavel NOT IN (13, 22)), 0) outros,
               coalesce(sum(votos) FILTER (WHERE ds_tipo_votavel IN ('Branco', 'Nulo')), 0) brancos_nulos
        FROM read_parquet('{BU}') WHERE cd_cargo = 1 GROUP BY ALL ORDER BY ALL""")
    cols = [d[0] for d in cur.description]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    OUT.write_text(json.dumps(rows, ensure_ascii=False, default=str), encoding="utf-8")
    print(len(rows), "linhas;", rows[0])


if __name__ == "__main__":
    sys.exit(main())
