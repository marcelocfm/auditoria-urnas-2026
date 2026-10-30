"""Aggregate the per-section raw-file audit (data/urna_audit/*.parquet) into the numbers shown on the site."""
import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
AUD = (ROOT / "data" / "urna_audit" / "*.parquet").as_posix()
OF_CAND = (ROOT / "data" / "parquet" / "oficial_candidato.parquet").as_posix()
OUT = ROOT / "site" / "public" / "data" / "urnas.json"

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
    con.execute(f"CREATE TABLE a AS SELECT * FROM read_parquet('{AUD}', union_by_name=true)")
    # Brasilia offset per municipality from the local opening time (voting opens 08:00 BSB everywhere in Brazil)
    con.execute("""CREATE TABLE fuso AS SELECT uf, municipio,
        round(median(hour(strptime(dt_abertura, '%Y%m%dT%H%M%S')) + minute(strptime(dt_abertura, '%Y%m%dT%H%M%S')) / 60.0)) - 8 AS off
        FROM a WHERE dt_abertura IS NOT NULL AND uf <> 'ZZ' GROUP BY ALL""")
    resumo = rows(con, """
        SELECT count(*) secoes,
            count(*) FILTER (WHERE erro IS NOT NULL) erro_leitura,
            count(*) FILTER (WHERE rdv_total IS NOT NULL) com_rdv,
            count(*) FILTER (WHERE rdv_cargos_divergentes > 0) rdv_diverge,
            sum(rdv_lula) rdv_lula, sum(rdv_flavio) rdv_flavio, sum(bu_lula) bu_lula, sum(bu_flavio) bu_flavio,
            sum(rdv_total) rdv_total, sum(bu_total) bu_total,
            count(*) FILTER (WHERE img_confere IS NOT NULL) com_impresso,
            count(*) FILTER (WHERE img_confere = false) impresso_diverge,
            count(*) FILTER (WHERE hash_arquivos IS NOT NULL) com_assinatura,
            sum(hash_arquivos) hashes, sum(hash_ok) hashes_ok,
            count(*) FILTER (WHERE hash_auto_ok = false) auto_hash_falha,
            count(*) FILTER (WHERE log_votos IS NOT NULL) com_log,
            count(*) FILTER (WHERE log_votos <> bu_total) log_diverge,
            count(*) FILTER (WHERE tipo_urna = 4) urnas_substituidas,
            count(*) FILTER (WHERE tipo_arquivo <> 1) apuracao_nao_urna
        FROM a""")[0]
    oficial = rows(con, f"""SELECT nr_candidato, sum(votos_nominais) votos FROM '{OF_CAND}'
                             WHERE cd_cargo = 1 AND turno = 2 GROUP BY 1""")
    resumo["oficial"] = {r["nr_candidato"]: r["votos"] for r in oficial}

    # votes computed per Brasilia hour, from each urna's own log
    por_hora = rows(con, """
        WITH h AS (SELECT a.uf, a.municipio, unnest(log_votos_hora) votos, generate_subscripts(log_votos_hora, 1) - 1 hora_local
                   FROM a WHERE log_votos_hora IS NOT NULL AND a.uf <> 'ZZ')
        SELECT (hora_local - coalesce(off, 0))::INT hora_brasilia, sum(votos) votos
        FROM h LEFT JOIN fuso USING (uf, municipio) GROUP BY 1 HAVING sum(votos) > 0 ORDER BY 1""")
    apos = rows(con, """
        WITH h AS (SELECT a.uf, a.municipio, bu_lula, bu_flavio, unnest(log_votos_hora) votos,
                          generate_subscripts(log_votos_hora, 1) - 1 hora_local
                   FROM a WHERE log_votos_hora IS NOT NULL AND a.uf <> 'ZZ')
        SELECT sum(votos) FILTER (WHERE hora_local - coalesce(off, 0) >= 17) apos_17h,
               sum(votos) FILTER (WHERE hora_local - coalesce(off, 0) >= 19) apos_19h
        FROM h LEFT JOIN fuso USING (uf, municipio)""")[0]

    # "old urna models favour one side": compare each section with the average of its own municipality
    modelo = rows(con, """
        WITH s AS (SELECT uf, municipio, modelo_urna, bu_lula, bu_flavio,
                          bu_lula::DOUBLE / nullif(bu_lula + bu_flavio, 0) p
                   FROM a WHERE modelo_urna IS NOT NULL AND bu_lula + bu_flavio > 0),
             m AS (SELECT uf, municipio, avg(p) pm, count(DISTINCT modelo_urna) n FROM s GROUP BY ALL)
        SELECT modelo_urna, count(*) secoes,
               round(100 * sum(bu_lula) / sum(bu_lula + bu_flavio), 2) pct_lula_bruto,
               round(100 * avg(p - pm) FILTER (WHERE n > 1), 2) desvio_vs_municipio_pp
        FROM s JOIN m USING (uf, municipio) GROUP BY 1 ORDER BY 1""")

    eventos = {}
    for f in sorted((ROOT / "data" / "urna_audit").glob("*_log.json")):
        for k, n in json.loads(f.read_text(encoding="utf-8")):
            eventos[k] = eventos.get(k, 0) + n
    top_erros = sorted(((k, n) for k, n in eventos.items() if k.startswith("ERRO")), key=lambda x: -x[1])[:15]
    voto_nao_registrado = sum(n for k, n in eventos.items() if "NÃO foi registrado" in k)

    payload = {"resumo": resumo, "votos_por_hora": por_hora, "apos_horario": apos, "modelo_urna": modelo,
               "erros_log": [{"evento": k, "ocorrencias": n} for k, n in top_erros],
               "voto_nao_registrado": voto_nao_registrado,
               "divergencias": rows(con, """SELECT uf, municipio, zona, secao, tipo_urna, bu_total, rdv_total,
                    log_votos, img_confere, hash_arquivos, hash_ok, rdv_divergencia, erro FROM a
                    WHERE erro IS NOT NULL OR rdv_cargos_divergentes > 0 OR img_confere = false
                       OR hash_ok <> hash_arquivos OR hash_auto_ok = false OR log_votos <> bu_total
                    ORDER BY ALL LIMIT 500""")}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8")
    print(json.dumps({k: v for k, v in payload.items() if k != "divergencias"}, ensure_ascii=False, default=str,
                     indent=1)[:6000])
    print("divergencias:", len(payload["divergencias"]))


if __name__ == "__main__":
    sys.exit(main())
