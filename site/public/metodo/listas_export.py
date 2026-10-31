"""Open lists of out-of-pattern sections, so anyone can check them locally -> site/public/data/listas.json."""
import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
BU = (ROOT / "data" / "parquet" / "bu" / "*.parquet").as_posix()
AUD = (ROOT / "data" / "urna_audit" / "*.parquet").as_posix()
MES = (ROOT / "data" / "mesario" / "*.parquet").as_posix()
OUT = ROOT / "site" / "public" / "data" / "listas.json"


def table(con, sql):
    cur = con.execute(sql)
    return {"colunas": [d[0] for d in cur.description], "linhas": [list(r) for r in cur.fetchall()]}


def one(con, sql):
    cur = con.execute(sql)
    return dict(zip([d[0] for d in cur.description], cur.fetchone()))


def main():
    con = duckdb.connect()
    con.execute(f"""CREATE TABLE s AS
        SELECT turno, uf, cd_municipio, any_value(nm_municipio) municipio, zona, secao, any_value(local_votacao) local,
               min(aptos) aptos, min(comparecimento) comp, any_value(nr_urna) urna,
               coalesce(sum(votos) FILTER (WHERE nr_votavel = 13 AND cd_tipo_votavel = 1), 0) l,
               coalesce(sum(votos) FILTER (WHERE nr_votavel = 22 AND cd_tipo_votavel = 1), 0) f
        FROM read_parquet('{BU}') WHERE cd_cargo = 1 GROUP BY turno, uf, cd_municipio, zona, secao""")
    con.execute("""CREATE TABLE d AS
        SELECT b.uf, b.cd_municipio, b.municipio, b.zona, b.secao, b.local, b.aptos, a.comp c1, b.comp c2,
               a.urna u1, b.urna u2, a.l l1, a.f f1, b.l l2, b.f f2
        FROM s a JOIN s b USING (uf, cd_municipio, zona, secao) WHERE a.turno = 1 AND b.turno = 2""")
    con.execute(f"""CREATE TABLE a AS
        SELECT x.*, m.liberados_mesario lib, m.max_por_mesario maxm, len(string_split(x.log_urnas, ',')) n_urnas_log
        FROM read_parquet('{AUD}', union_by_name = true) x
        LEFT JOIN read_parquet('{MES}') m USING (prefixo, uf)
        WHERE x.erro IS NULL""")

    # one poll worker released 100+ voters with their own fingerprint
    mesario = table(con, """
        SELECT d.uf, d.municipio, d.zona, d.secao, a.maxm maior_por_mesario, a.lib liberados, d.c2 votaram, d.l2 lula, d.f2 flavio
        FROM a JOIN d ON a.uf = d.uf AND a.municipio = d.cd_municipio AND a.zona = d.zona AND a.secao = d.secao
        WHERE a.maxm >= 100 ORDER BY a.maxm DESC""")

    # turnout rose 20+ points of the electorate between rounds
    comparecimento = table(con, """
        SELECT uf, municipio, zona, secao, aptos, c1 votaram_1t, c2 votaram_2t,
               round(100.0 * (c2 - c1) / aptos, 1) subiu_pp, l2 lula, f2 flavio
        FROM d WHERE aptos > 0 AND 100.0 * (c2 - c1) / aptos >= 20 ORDER BY subiu_pp DESC""")
    comparecimento_faixas = table(con, """
        SELECT CASE WHEN p < 5 THEN 'Menos de 5' WHEN p < 10 THEN '5 a 10' WHEN p < 20 THEN '10 a 20' ELSE '20 ou mais' END faixa_pp,
               count(*) secoes, sum(l2) lula, sum(f2) flavio
        FROM (SELECT *, 100.0 * (c2 - c1) / aptos p FROM d WHERE aptos > 0 AND c2 > c1) GROUP BY 1 ORDER BY min(p)""")

    # a different machine in each round is routine (machines are reassigned); swaps during voting day are in tipo_urna
    trocas = one(con, """SELECT count(*) secoes, count(*) FILTER (WHERE u1 <> u2) urna_diferente_entre_turnos FROM d""")
    trocas["substituidas_no_dia"] = one(con, """
        SELECT count(*) FILTER (WHERE tipo_urna <> 1) urnas, sum(bu_total) FILTER (WHERE tipo_urna <> 1) votos,
               count(*) FILTER (WHERE tipo_urna <> 1 AND rdv_total = bu_total) rdv_confere FROM a""")
    trocas["por_uf"] = table(con, """
        SELECT uf, count(*) FILTER (WHERE tipo_urna <> 1) substituidas, count(*) urnas,
               round(100.0 * count(*) FILTER (WHERE tipo_urna <> 1) / count(*), 2) pct
        FROM a GROUP BY 1 ORDER BY pct DESC""")

    # sections where the log holds fewer/more votes than the tally
    log_bu = table(con, """
        SELECT d.uf, d.municipio, d.zona, d.secao, a.tipo_urna, a.n_urnas_log, a.bu_total votos_bu, a.log_votos votos_no_log,
               a.rdv_total votos_rdv, d.l2 lula, d.f2 flavio
        FROM a JOIN d ON a.uf = d.uf AND a.municipio = d.cd_municipio AND a.zona = d.zona AND a.secao = d.secao
        WHERE a.log_votos <> a.bu_total ORDER BY abs(a.log_votos - a.bu_total) DESC""")
    log_bu_resumo = one(con, """
        SELECT count(*) secoes, count(*) FILTER (WHERE tipo_urna <> 1) em_urna_substituida,
               count(*) FILTER (WHERE rdv_total = bu_total) rdv_confere, sum(bu_total - log_votos) votos_fora_do_log
        FROM a WHERE log_votos <> bu_total""")

    payload = {"mesario_100": mesario, "comparecimento_20pp": comparecimento, "comparecimento_faixas": comparecimento_faixas,
               "trocas": trocas, "log_bu": log_bu, "log_bu_resumo": log_bu_resumo}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, default=str, separators=(",", ":")), encoding="utf-8")
    print(f"mesario {len(mesario['linhas'])}, comparecimento {len(comparecimento['linhas'])}, log_bu {len(log_bu['linhas'])}")
    print(json.dumps({k: payload[k] for k in ("comparecimento_faixas", "trocas", "log_bu_resumo")}, ensure_ascii=False, default=str))


if __name__ == "__main__":
    sys.exit(main())
