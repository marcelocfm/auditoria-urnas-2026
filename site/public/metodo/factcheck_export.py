"""Numbers behind the fact-check section of the site -> site/public/data/factcheck.json."""
import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
BU = (ROOT / "data" / "parquet" / "bu" / "*.parquet").as_posix()
OF_DET = (ROOT / "data" / "parquet" / "oficial_detalhe.parquet").as_posix()
LOG = (ROOT / "data" / "log_forense" / "*.parquet").as_posix()
AUD = (ROOT / "data" / "urna_audit" / "*.parquet").as_posix()
MES = (ROOT / "data" / "mesario" / "*.parquet").as_posix()
OUT = ROOT / "site" / "public" / "data" / "factcheck.json"


def one(con, sql):
    cur = con.execute(sql)
    cols = [d[0] for d in cur.description]
    return dict(zip(cols, cur.fetchone()))


def rows(con, sql):
    cur = con.execute(sql)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def mesarios(con):
    """Voters released by a poll worker's own fingerprint (fingerprint failed): how many, where, and with what vote."""
    if len(list((ROOT / "data" / "mesario").glob("*.parquet"))) < 28:
        return None  # pass still running: publish nothing rather than a partial count
    con.execute(f"""CREATE TABLE m AS
        SELECT a.uf, a.municipio, a.bu_lula l, a.bu_flavio f, a.bu_total total,
               m.liberados_mesario lib, m.max_por_mesario maxm, m.mesarios_distintos dist, m.manual, m.mesario_apos_17h apos17
        FROM read_parquet('{AUD}', union_by_name = true) a
        JOIN read_parquet('{MES}') m USING (prefixo, uf)
        WHERE a.bu_total > 0""")
    resumo = one(con, """
        SELECT count(*) urnas, sum(total) votos, sum(lib) liberados_mesario, round(100.0 * sum(lib) / sum(total), 2) pct,
               sum(manual) habilitacao_manual, sum(apos17) liberados_apos_17h,
               count(*) FILTER (WHERE lib::DOUBLE / total > 0.2) urnas_acima_20pct,
               count(*) FILTER (WHERE maxm >= 20) urnas_mesario_20_ou_mais,
               count(*) FILTER (WHERE maxm >= 50) urnas_mesario_50_ou_mais,
               max(maxm) maior_por_mesario
        FROM m""")
    # each section compared with the other sections of the same city, so regional differences don't leak in
    faixas = rows(con, """
        WITH x AS (SELECT *, lib::DOUBLE / total t, l::DOUBLE / nullif(l + f, 0) p FROM m WHERE l + f > 0),
             y AS (SELECT *, p - avg(p) OVER (PARTITION BY uf, municipio) dp FROM x)
        SELECT CASE WHEN t = 0 THEN 'Nenhum' WHEN t < 0.05 THEN 'Até 5%' WHEN t < 0.2 THEN '5% a 20%' ELSE 'Mais de 20%' END faixa,
               count(*) urnas, sum(lib) liberados,
               round(100 * avg(dp), 2) lula_vs_cidade_pp, round(-100 * avg(dp), 2) flavio_vs_cidade_pp
        FROM y GROUP BY 1 ORDER BY min(t)""")
    resumo["faixas"] = faixas
    # sections where one poll worker released many voters (typical of a failing fingerprint reader)
    resumo["por_mesario"] = rows(con, """
        WITH x AS (SELECT *, l::DOUBLE / nullif(l + f, 0) p FROM m WHERE l + f > 0),
             y AS (SELECT *, p - avg(p) OVER (PARTITION BY uf, municipio) dp FROM x)
        SELECT CASE WHEN maxm < 20 THEN 'Menos de 20' WHEN maxm < 50 THEN '20 a 49' WHEN maxm < 100 THEN '50 a 99'
                    ELSE '100 ou mais' END grupo,
               count(*) urnas, sum(lib) liberados, sum(l + f) votos_lula_flavio,
               round(100 * avg(dp), 2) lula_vs_cidade_pp, round(-100 * avg(dp), 2) flavio_vs_cidade_pp
        FROM y GROUP BY 1 ORDER BY min(maxm)""")
    return resumo


def main():
    con = duckdb.connect()
    con.execute(f"""CREATE TABLE s AS
        SELECT turno, uf, cd_municipio, any_value(nm_municipio) municipio, zona, secao, min(aptos) aptos,
               min(comparecimento) comp, max(biom_sem_habilitacao) semb,
               coalesce(sum(votos) FILTER (WHERE nr_votavel = 13 AND cd_tipo_votavel = 1), 0) l,
               coalesce(sum(votos) FILTER (WHERE nr_votavel = 22 AND cd_tipo_votavel = 1), 0) f
        FROM read_parquet('{BU}') WHERE cd_cargo = 1 AND uf <> 'ZZ' GROUP BY turno, uf, cd_municipio, zona, secao""")
    con.execute("""CREATE TABLE d AS SELECT a.uf, a.cd_municipio, a.municipio, b.aptos, a.comp c1, b.comp c2,
                       a.semb s1, b.semb s2, a.l l1, b.l l2, a.f f1, b.f f2
                   FROM s a JOIN s b USING (uf, cd_municipio, zona, secao) WHERE a.turno = 1 AND b.turno = 2""")

    abstencao = rows(con, f"""SELECT turno, sum(aptos) aptos, sum(comparecimento) comparecimento,
                                     round(100 - 100.0 * sum(comparecimento) / sum(aptos), 2) abstencao_pct
                              FROM '{OF_DET}' WHERE cd_cargo = 1 GROUP BY 1 ORDER BY 1""")
    biometria = one(con, """SELECT sum(s1) sem_biometria_1t, sum(s2) sem_biometria_2t,
                                   round(100.0 * sum(s1) / sum(c1), 2) pct_1t, round(100.0 * sum(s2) / sum(c2), 2) pct_2t
                            FROM d""")
    por_comparecimento = rows(con, """
        SELECT CASE WHEN 100.0 * (c2 - c1) / aptos < 0 THEN 'Caiu' WHEN 100.0 * (c2 - c1) / aptos < 5 THEN 'Subiu até 5 pontos'
                    ELSE 'Subiu mais de 5 pontos' END faixa,
               count(*) secoes, sum(c2 - c1) votantes_a_mais,
               round(100 * (sum(l2) / sum(l2 + f2) - sum(l1) / sum(l1 + f1)), 2) variacao_lula_pp,
               round(100 * (sum(f2) / sum(l2 + f2) - sum(f1) / sum(l1 + f1)), 2) variacao_flavio_pp
        FROM d WHERE aptos > 0 AND l1 + f1 > 0 AND l2 + f2 > 0 GROUP BY 1 ORDER BY min(100.0 * (c2 - c1) / aptos)""")
    extremos = one(con, """
        SELECT count(*) secoes, sum(l1) lula_1t, sum(f1) flavio_1t, sum(l2) lula_2t, sum(f2) flavio_2t
        FROM d WHERE l2 + f2 >= 50 AND f2 = 0""")
    extremos["municipios"] = [r["municipio"] for r in rows(con, """
        SELECT municipio, count(*) n FROM d WHERE l2 + f2 >= 50 AND f2 = 0 GROUP BY 1 ORDER BY 2 DESC LIMIT 8""")]
    extremos_flavio = one(con, "SELECT count(*) secoes FROM d WHERE l2 + f2 >= 50 AND l2 = 0")

    log = one(con, f"""
        SELECT count(*) urnas, count(*) FILTER (WHERE erro IS NOT NULL) erros, sum(habilitados) habilitados,
               sum(computados) computados, sum(sem_habilitacao) votos_sem_habilitacao,
               count(*) FILTER (WHERE sem_habilitacao > 0) urnas_com_voto_sem_habilitacao,
               sum(gaps_10s) intervalos_menores_10s, count(*) FILTER (WHERE maior_sequencia_20s >= 5) urnas_rajada_5,
               min(menor_gap) menor_intervalo_s, sum(por_biometria) por_biometria
        FROM read_parquet('{LOG}')""")

    payload = {"abstencao": abstencao, "biometria": biometria, "por_comparecimento": por_comparecimento,
               "extremos": extremos, "extremos_flavio": extremos_flavio["secoes"], "log": log,
               "mesario": mesarios(con)}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, default=str, indent=1))


if __name__ == "__main__":
    sys.exit(main())
