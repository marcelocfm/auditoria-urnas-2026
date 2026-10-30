"""Test the public fraud claims about the 2026 presidential runoff against the BU data; export JSON for the site.

Claims tested:
  1. "Flavio was winning until the count flipped" -> rebuild the count in the order BUs reached the TSE.
  2. "The extended voting hours (until 19h) decided it" -> votes in sections that closed late.
  3. "Lula's growth between rounds is mathematically impossible" -> decompose each section's change.
"""
import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
BU = (ROOT / "data" / "parquet" / "bu" / "*.parquet").as_posix()
OUT = ROOT / "site" / "public" / "data" / "alegacoes.json"

REGIAO = """CASE WHEN uf IN ('AL','BA','CE','MA','PB','PE','PI','RN','SE') THEN 'Nordeste'
    WHEN uf IN ('SP','RJ','MG','ES') THEN 'Sudeste' WHEN uf IN ('PR','SC','RS') THEN 'Sul'
    WHEN uf IN ('AC','AM','AP','PA','RO','RR','TO') THEN 'Norte' WHEN uf = 'ZZ' THEN 'Exterior'
    ELSE 'Centro-Oeste' END"""


def rows(con, sql):
    cur = con.execute(sql)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def main():
    con = duckdb.connect()
    con.execute(f"""CREATE TABLE s AS
        SELECT turno, uf, cd_municipio, zona, secao, min(comparecimento) comp, min(dt_bu_recebido) rec,
               min(dt_abertura) ab, min(dt_encerramento) enc, min(dt_emissao_bu) em,
               coalesce(sum(votos) FILTER (WHERE nr_votavel = 13 AND cd_tipo_votavel = 1), 0) l,
               coalesce(sum(votos) FILTER (WHERE nr_votavel = 22 AND cd_tipo_votavel = 1), 0) f,
               coalesce(sum(votos) FILTER (WHERE cd_tipo_votavel = 1 AND nr_votavel NOT IN (13, 22)), 0) o,
               coalesce(sum(votos) FILTER (WHERE ds_tipo_votavel IN ('Branco', 'Nulo')), 0) bn
        FROM read_parquet('{BU}') WHERE cd_cargo = 1 GROUP BY ALL""")
    con.execute(f"ALTER TABLE s ADD COLUMN regiao VARCHAR; UPDATE s SET regiao = {REGIAO}")

    apuracao = rows(con, """
        WITH t AS (SELECT time_bucket(INTERVAL 5 MINUTE, rec) + INTERVAL 5 MINUTE ate, count(*) n, sum(l) l, sum(f) f
                   FROM s WHERE turno = 2 GROUP BY 1)
        SELECT strftime(ate, '%H:%M') ate, sum(n) OVER w boletins, sum(l) OVER w lula, sum(f) OVER w flavio
        FROM t WINDOW w AS (ORDER BY ate) ORDER BY ate""")
    chegada = rows(con, """
        SELECT regiao, round(100.0 * sum(l) / (sum(l) + sum(f)), 1) pct_lula,
               strftime(median(rec), '%H:%M') mediana_chegada, count(*) secoes
        FROM s WHERE turno = 2 GROUP BY 1 ORDER BY median(rec)""")

    con.execute("""CREATE TABLE fuso AS SELECT cd_municipio, round(median(hour(ab) + minute(ab) / 60.0)) - 8 off
                   FROM s WHERE turno = 1 AND uf <> 'ZZ' AND ab IS NOT NULL GROUP BY 1""")
    encerramento = rows(con, """
        WITH e AS (SELECT s.*, (enc - to_hours(off::INT))::TIME t FROM s JOIN fuso USING (cd_municipio)
                   WHERE turno = 2 AND uf <> 'ZZ')
        SELECT CASE WHEN t < TIME '17:30' THEN 'até 17h30' WHEN t < TIME '19:00' THEN '17h30–19h'
                    ELSE '19h ou depois' END faixa,
               count(*) secoes, sum(comp) votantes, sum(l) lula, sum(f) flavio
        FROM e GROUP BY 1 ORDER BY min(t)""")

    con.execute("""CREATE TABLE d AS SELECT a.uf, a.regiao, a.comp c1, b.comp c2, a.l l1, b.l l2, a.f f1, b.f f2,
                       a.o o1, a.bn bn1, b.bn bn2
                   FROM s a JOIN s b USING (uf, cd_municipio, zona, secao) WHERE a.turno = 1 AND b.turno = 2""")
    transferencia = rows(con, """
        SELECT sum(l2 - l1) ganho_lula, sum(f2 - f1) ganho_flavio, sum(o1) outros_1t, sum(bn1 - bn2) queda_brancos_nulos,
               sum(c2 - c1) novos_votantes, count(*) secoes,
               count(*) FILTER (WHERE (l2 - l1) > o1 + greatest(bn1 - bn2, 0) + greatest(c2 - c1, 0) + greatest(f1 - f2, 0))
                   secoes_impossiveis
        FROM d""")[0]
    por_regiao = rows(con, """
        SELECT regiao, sum(l2 - l1) ganho_lula, sum(f2 - f1) ganho_flavio, sum(o1) outros_1t,
               sum(bn1 - bn2) queda_brancos_nulos, sum(c2 - c1) novos_votantes
        FROM d GROUP BY 1 ORDER BY 2 DESC""")

    # when each BU was printed at the section (local clock -> Brasilia) vs. when the TSE registered it
    emissao_vs_registro = rows(con, """
        WITH e AS (SELECT s.turno, (s.em - to_hours(f.off::INT)) em_bsb, s.rec FROM s JOIN fuso f USING (cd_municipio)
                   WHERE s.uf <> 'ZZ')
        SELECT turno, h hora, sum(emit)::BIGINT emitidos, sum(reg)::BIGINT registrados FROM (
            SELECT turno, hour(em_bsb) h, 1 emit, 0 reg FROM e UNION ALL SELECT turno, hour(rec), 0, 1 FROM e)
        WHERE h BETWEEN 16 AND 23 GROUP BY ALL ORDER BY ALL""")

    payload = {"apuracao": apuracao, "chegada_por_regiao": chegada, "encerramento": encerramento,
               "transferencia": transferencia, "transferencia_regiao": por_regiao,
               "emissao_vs_registro": emissao_vs_registro}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8")
    print(json.dumps({k: v for k, v in payload.items() if k != "apuracao"}, ensure_ascii=False, default=str, indent=1))


if __name__ == "__main__":
    sys.exit(main())
