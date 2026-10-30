"""Forensic stress-test cube, digit uniformity, 1T->2T retention, and regional breakdown -> site/public/data/forense.json."""
import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
BU = (ROOT / "data" / "parquet" / "bu" / "*.parquet").as_posix()
AUD = (ROOT / "data" / "urna_audit" / "*.parquet").as_posix()
LOG = (ROOT / "data" / "log_forense" / "*.parquet").as_posix()
MES = (ROOT / "data" / "mesario" / "*.parquet").as_posix()
OUT = ROOT / "site" / "public" / "data" / "forense.json"


def rows(con, sql):
    cur = con.execute(sql)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def one(con, sql):
    cur = con.execute(sql)
    cols = [d[0] for d in cur.description]
    return dict(zip(cols, cur.fetchone()))


def digit_series(con, table, col):
    raw = dict(con.execute(f"SELECT {col} % 10 AS d, count(*) AS n FROM {table} WHERE {col} >= 50 GROUP BY 1").fetchall())
    total = sum(raw.values())
    expected = total / 10.0
    chi2 = round(sum((raw.get(d, 0) - expected) ** 2 / expected for d in range(10)), 2)
    pcts = [round(100.0 * raw.get(d, 0) / total, 2) for d in range(10)]
    counts = [int(raw.get(d, 0)) for d in range(10)]
    return {"secoes": int(total), "chi2": chi2, "critico_95": 16.92, "pcts": pcts, "contagens": counts}


def main():
    con = duckdb.connect()

    con.execute(f"""
        CREATE TABLE s1 AS
        SELECT uf, cd_municipio, any_value(nm_municipio) municipio, zona, secao,
               min(aptos) aptos_1t, min(comparecimento) comp_1t, any_value(nr_urna) urna_1t,
               coalesce(sum(votos) FILTER (WHERE nr_votavel = 13 AND cd_tipo_votavel = 1), 0) l1,
               coalesce(sum(votos) FILTER (WHERE nr_votavel = 22 AND cd_tipo_votavel = 1), 0) f1
        FROM read_parquet('{BU}')
        WHERE turno = 1 AND cd_cargo = 1
        GROUP BY uf, cd_municipio, zona, secao
    """)

    con.execute(f"""
        CREATE TABLE s2 AS
        SELECT uf, cd_municipio, any_value(nm_municipio) municipio, zona, secao,
               min(aptos) aptos_2t, min(comparecimento) comp_2t, max(biom_sem_habilitacao) semb_2t,
               any_value(nr_urna) urna_2t, any_value(dt_encerramento) dt_encerramento,
               coalesce(sum(votos) FILTER (WHERE nr_votavel = 13 AND cd_tipo_votavel = 1), 0) l2,
               coalesce(sum(votos) FILTER (WHERE nr_votavel = 22 AND cd_tipo_votavel = 1), 0) f2,
               coalesce(sum(votos) FILTER (WHERE cd_tipo_votavel = 2), 0) brancos2,
               coalesce(sum(votos) FILTER (WHERE cd_tipo_votavel = 3), 0) nulos2
        FROM read_parquet('{BU}')
        WHERE turno = 2 AND cd_cargo = 1
        GROUP BY uf, cd_municipio, zona, secao
    """)

    con.execute(f"""
        CREATE TABLE aud AS
        SELECT a.uf, a.municipio, a.zona, a.secao, a.tipo_urna, a.versao, a.modelo_urna,
               a.bu_total, a.rdv_total, a.img_confere, a.hash_arquivos, a.hash_ok, a.log_votos,
               l.sem_habilitacao, l.gaps_10s,
               m.liberados_mesario, m.manual
        FROM read_parquet('{AUD}', union_by_name = true) a
        LEFT JOIN read_parquet('{LOG}', union_by_name = true) l USING (uf, prefixo)
        LEFT JOIN read_parquet('{MES}', union_by_name = true) m USING (uf, prefixo)
    """)

    # 9-bit combinatorial cube across all 499,207 2nd-round sections:
    #   bit 0 (1):   urna older than UE2020 (UE2013/UE2015 or paper ballot)
    #   bit 1 (2):   urna not UE2022
    #   bit 2 (4):   any poll-worker fingerprint release (liberados_mesario > 0)
    #   bit 3 (8):   >5% voters released without biometrics
    #   bit 4 (16):  contingency/swapped machine or log!=BU count
    #   bit 5 (32):  >90% valid votes for a single candidate
    #   bit 6 (64):  turnout jumped >5pp from 1T to 2T
    #   bit 7 (128): closed at/after 17:15 local time OR aptos changed between 1T and 2T
    #   bit 8 (256): section in Northeast region (for geographic comparison)
    con.execute("""
        CREATE TABLE full_2t AS
        SELECT s2.*,
               s1.aptos_1t, s1.comp_1t, s1.urna_1t, s1.l1, s1.f1,
               a.modelo_urna, a.tipo_urna AS aud_tipo_urna, a.versao,
               a.bu_total AS aud_bu_total, a.log_votos, a.liberados_mesario, a.manual,
               (CASE WHEN coalesce(a.modelo_urna, 0) NOT IN (20, 22) THEN 1 ELSE 0 END)
             + (CASE WHEN coalesce(a.modelo_urna, 0) <> 22 THEN 2 ELSE 0 END)
             + (CASE WHEN coalesce(a.liberados_mesario, 0) > 0 THEN 4 ELSE 0 END)
             + (CASE WHEN s2.comp_2t > 0 AND s2.semb_2t > 0.05 * s2.comp_2t THEN 8 ELSE 0 END)
             + (CASE WHEN coalesce(a.tipo_urna, 0) <> 1
                       OR s1.urna_1t IS DISTINCT FROM s2.urna_2t
                       OR a.bu_total IS DISTINCT FROM a.log_votos THEN 16 ELSE 0 END)
             + (CASE WHEN (s2.l2 + s2.f2) > 0
                      AND (s2.l2 > 0.90 * (s2.l2 + s2.f2) OR s2.f2 > 0.90 * (s2.l2 + s2.f2)) THEN 32 ELSE 0 END)
             + (CASE WHEN s2.aptos_2t > 0 AND s1.comp_1t IS NOT NULL
                      AND (s2.comp_2t - s1.comp_1t) > 0.05 * s2.aptos_2t THEN 64 ELSE 0 END)
             + (CASE WHEN (s2.dt_encerramento IS NOT NULL AND extract('hour' FROM s2.dt_encerramento) * 60 + extract('minute' FROM s2.dt_encerramento) >= 17 * 60 + 15)
                       OR s1.aptos_1t IS DISTINCT FROM s2.aptos_2t THEN 128 ELSE 0 END)
             + (CASE WHEN s2.uf IN ('AL','BA','CE','MA','PB','PE','PI','RN','SE') THEN 256 ELSE 0 END)
               AS mask
        FROM s2
        LEFT JOIN s1 USING (uf, cd_municipio, zona, secao)
        LEFT JOIN aud a ON s2.uf = a.uf AND s2.cd_municipio = a.municipio AND s2.zona = a.zona AND s2.secao = a.secao
    """)

    cubo = [
        [int(r[0]), int(r[1]), int(r[2]), int(r[3]), int(r[4])]
        for r in con.execute("""
            SELECT mask, count(*) secoes, sum(l2) lula, sum(f2) flavio, sum(comp_2t) comp
            FROM full_2t GROUP BY 1 ORDER BY 1
        """).fetchall()
    ]

    regioes = rows(con, """
        SELECT
          CASE
            WHEN uf IN ('PR','RS','SC') THEN 'Sul'
            WHEN uf IN ('ES','MG','RJ','SP') THEN 'Sudeste'
            WHEN uf IN ('DF','GO','MS','MT') THEN 'Centro-Oeste'
            WHEN uf IN ('AC','AM','AP','PA','RO','RR','TO') THEN 'Norte'
            WHEN uf IN ('AL','BA','CE','MA','PB','PE','PI','RN','SE') THEN 'Nordeste'
            ELSE 'Exterior'
          END AS regiao,
          count(DISTINCT uf) AS ufs,
          count(*) AS secoes,
          sum(l1) AS lula_1t,
          sum(f1) AS flavio_1t,
          sum(l2) AS lula_2t,
          sum(f2) AS flavio_2t,
          round(100.0 * sum(l2) / (sum(l2) + sum(f2)), 2) AS pct_lula_2t,
          round(100.0 * sum(f2) / (sum(l2) + sum(f2)), 2) AS pct_flavio_2t,
          sum(l2) - sum(f2) AS saldo_lula_2t
        FROM full_2t
        GROUP BY 1
        ORDER BY saldo_lula_2t ASC
    """)

    estados_vencidos = one(con, """
        WITH por_uf AS (
            SELECT uf, sum(l1) l1, sum(f1) f1, sum(l2) l2, sum(f2) f2
            FROM full_2t WHERE uf <> 'ZZ' GROUP BY 1
        )
        SELECT
          count(*) FILTER (WHERE f1 > l1) AS flavio_ufs_1t,
          count(*) FILTER (WHERE l1 > f1) AS lula_ufs_1t,
          count(*) FILTER (WHERE f2 > l2) AS flavio_ufs_2t,
          count(*) FILTER (WHERE l2 > f2) AS lula_ufs_2t
        FROM por_uf
    """)

    retencao = one(con, """
        SELECT
          count(*) AS secoes_pareadas,
          count(*) FILTER (WHERE f2 < f1) AS flavio_caiu_secoes,
          sum(f1 - f2) FILTER (WHERE f2 < f1) AS flavio_caiu_votos,
          count(*) FILTER (WHERE f2 < f1 AND comp_2t >= comp_1t) AS flavio_caiu_comp_subiu_secoes,
          count(*) FILTER (WHERE f2 < f1 AND comp_2t >= comp_1t AND (f1 - f2) <= 5) AS flavio_caiu_ate_5,
          count(*) FILTER (WHERE f2 < f1 AND comp_2t >= comp_1t AND (f1 - f2) > 20) AS flavio_caiu_acima_20,
          count(*) FILTER (WHERE l2 < l1) AS lula_caiu_secoes,
          sum(l1 - l2) FILTER (WHERE l2 < l1) AS lula_caiu_votos,
          count(*) FILTER (WHERE l2 < l1 AND comp_2t >= comp_1t) AS lula_caiu_comp_subiu_secoes
        FROM full_2t
        WHERE l1 IS NOT NULL
    """)

    integridade = one(con, """
        SELECT
          count(*) AS urnas_binarias,
          count(DISTINCT versao) AS versoes_distintas,
          any_value(versao) AS versao_software,
          sum(hash_arquivos) AS hashes_verificados,
          sum(hash_ok) AS hashes_ok,
          count(*) FILTER (WHERE rdv_total <> bu_total) AS rdv_divergentes,
          count(*) FILTER (WHERE NOT img_confere) AS img_divergentes,
          sum( coalesce(sem_habilitacao, 0) ) AS votos_sem_habilitacao,
          sum( coalesce(manual, 0) ) AS habilitacoes_manuais,
          sum( coalesce(liberados_mesario, 0) ) AS liberados_mesario
        FROM aud
    """)

    digitos = {
        "comparecimento_2t": digit_series(con, "s2", "comp_2t"),
        "lula_2t": digit_series(con, "s2", "l2"),
        "flavio_2t": digit_series(con, "s2", "f2"),
    }

    payload = {
        "cubo_colunas": ["mask", "secoes", "lula", "flavio", "comparecimento"],
        "cubo": cubo,
        "regioes": regioes,
        "estados_vencidos": estados_vencidos,
        "retencao": retencao,
        "integridade": integridade,
        "digitos": digitos,
    }

    OUT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes, {len(cubo)} cube buckets)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
