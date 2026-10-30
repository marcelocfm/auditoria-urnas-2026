"""Run consistency checks over 2026 BU data and official totals.

Each check writes the offending rows to data/audit/<check>.csv and a line to resumo.csv.
"""
import csv
import sys
from pathlib import Path

import duckdb

BASE = Path(__file__).resolve().parent.parent / "data"
PQ = BASE / "parquet"
OUT = BASE / "audit"

ELECTION_DAY = {1: "2026-10-04", 2: "2026-10-25"}

SETUP = f"""
CREATE VIEW bu AS SELECT * FROM read_parquet('{(PQ / 'bu' / '*.parquet').as_posix()}');
CREATE VIEW oficial_candidato AS SELECT * FROM '{(PQ / 'oficial_candidato.parquet').as_posix()}';
CREATE VIEW oficial_detalhe AS SELECT * FROM '{(PQ / 'oficial_detalhe.parquet').as_posix()}';

-- one row per section/office with its header fields and vote totals
CREATE TABLE secao_cargo AS
SELECT turno, uf, cd_municipio, zona, secao, cd_cargo,
    min(aptos) AS aptos, max(aptos) AS aptos_max,
    min(comparecimento) AS comparecimento, max(comparecimento) AS comparecimento_max,
    min(abstencoes) AS abstencoes,
    count(DISTINCT nr_urna) AS n_urnas, min(nr_urna) AS nr_urna,
    min(cd_tipo_urna) AS cd_tipo_urna, any_value(ds_tipo_urna) AS ds_tipo_urna,
    min(dt_abertura) AS dt_abertura, min(dt_encerramento) AS dt_encerramento,
    min(dt_emissao_bu) AS dt_emissao_bu, min(dt_bu_recebido) AS dt_bu_recebido,
    min(dt_carga) AS dt_carga, max(biom_sem_habilitacao) AS biom_sem_habilitacao,
    any_value(secoes_agregadas) AS secoes_agregadas,
    sum(votos) AS votos,
    sum(votos) FILTER (WHERE cd_tipo_votavel = 1) AS nominais,
    sum(votos) FILTER (WHERE ds_tipo_votavel = 'Branco') AS brancos,
    sum(votos) FILTER (WHERE ds_tipo_votavel = 'Nulo') AS nulos,
    sum(votos) FILTER (WHERE ds_tipo_votavel = 'Legenda') AS legenda,
    count(*) AS linhas
FROM bu GROUP BY ALL;

CREATE TABLE secao AS
SELECT turno, uf, cd_municipio, zona, secao,
    count(DISTINCT aptos) AS v_aptos, count(DISTINCT comparecimento) AS v_comp,
    count(DISTINCT nr_urna) AS v_urna, count(DISTINCT dt_abertura) AS v_abert,
    count(DISTINCT dt_encerramento) AS v_encer, count(DISTINCT dt_emissao_bu) AS v_emissao,
    min(aptos) AS aptos, min(comparecimento) AS comparecimento, min(nr_urna) AS nr_urna,
    min(cd_tipo_urna) AS cd_tipo_urna, any_value(ds_tipo_urna) AS ds_tipo_urna,
    min(dt_abertura) AS dt_abertura, min(dt_encerramento) AS dt_encerramento,
    min(dt_emissao_bu) AS dt_emissao_bu, min(dt_bu_recebido) AS dt_bu_recebido, min(dt_carga) AS dt_carga,
    max(biom_sem_habilitacao) AS biom_sem_habilitacao, any_value(secoes_agregadas) AS secoes_agregadas,
    list(DISTINCT cd_cargo ORDER BY cd_cargo) AS cargos
FROM secao_cargo GROUP BY ALL;

-- local clock offset vs Brasilia, inferred per municipality from the typical opening hour (08:00 BSB)
CREATE TABLE fuso AS
SELECT uf, cd_municipio, round(median(hour(dt_abertura) + minute(dt_abertura) / 60.0)) - 8 AS offset_h
FROM secao WHERE dt_abertura IS NOT NULL GROUP BY ALL;
"""

# name -> (description, SQL returning offending rows)
CHECKS = {
    "aptos_neq_comparecimento_mais_abstencoes": (
        "QT_APTOS diferente de comparecimento + abstencoes",
        "SELECT * FROM secao_cargo WHERE aptos <> comparecimento + abstencoes",
    ),
    "comparecimento_maior_que_aptos": (
        "Mais eleitores votaram do que os aptos na secao",
        "SELECT * FROM secao_cargo WHERE comparecimento > aptos",
    ),
    "cabecalho_divergente_na_mesma_secao": (
        "Mesma secao com aptos/comparecimento/urna/horarios diferentes entre linhas",
        """SELECT * FROM secao WHERE v_aptos > 1 OR v_comp > 1 OR v_urna > 1
               OR v_abert > 1 OR v_encer > 1 OR v_emissao > 1""",
    ),
    "soma_votos_diferente_do_comparecimento": (
        "Soma dos votos do cargo (nominal+legenda+branco+nulo) != comparecimento x vagas",
        """SELECT *, votos / comparecimento AS razao FROM secao_cargo
           WHERE votos <> comparecimento * CASE WHEN cd_cargo = 5 AND turno = 1 THEN 2 ELSE 1 END""",
    ),
    "linhas_duplicadas": (
        "Mesmo votavel aparece mais de uma vez no BU da mesma secao/cargo",
        """SELECT turno, uf, zona, secao, cd_cargo, cd_tipo_votavel, nr_votavel, count(*) n, list(votos) votos
           FROM bu GROUP BY ALL HAVING count(*) > 1""",
    ),
    "votos_nao_positivos": (
        "Linha com quantidade de votos <= 0",
        "SELECT * FROM bu WHERE votos <= 0",
    ),
    "cargo_ausente": (
        "Secao sem um cargo que as demais secoes do mesmo municipio tem",
        """WITH esperado AS (
               SELECT turno, uf, cd_municipio, list(DISTINCT cd_cargo ORDER BY cd_cargo) AS cargos_mun
               FROM secao_cargo GROUP BY ALL)
           SELECT s.turno, s.uf, s.cd_municipio, s.zona, s.secao, s.cargos, e.cargos_mun, s.aptos, s.comparecimento
           FROM secao s JOIN esperado e USING (turno, uf, cd_municipio)
           WHERE s.cargos <> e.cargos_mun""",
    ),
    "mesma_urna_em_secoes_diferentes": (
        "Mesmo numero de urna efetivada registrado em mais de uma secao no mesmo turno",
        """SELECT turno, nr_urna, count(*) n, list((uf, zona, secao)) secoes
           FROM secao WHERE nr_urna > 0 GROUP BY ALL HAVING count(*) > 1""",
    ),
    "biometria_maior_que_comparecimento": (
        "Eleitores liberados sem biometria > comparecimento",
        "SELECT * FROM secao WHERE biom_sem_habilitacao > comparecimento",
    ),
    "ordem_temporal_impossivel": (
        "Abertura >= encerramento, BU emitido antes do encerramento, ou carga apos a abertura",
        """SELECT *,
               CASE WHEN dt_abertura >= dt_encerramento THEN 'abertura>=encerramento'
                    WHEN dt_emissao_bu < dt_encerramento THEN 'emissao<encerramento'
                    ELSE 'carga>abertura' END AS motivo
           FROM secao
           WHERE dt_abertura >= dt_encerramento OR dt_emissao_bu < dt_encerramento OR dt_carga > dt_abertura""",
    ),
    "bu_recebido_antes_de_emitido": (
        "Horario de recebimento no TSE (Brasilia) anterior a emissao do BU (convertida para Brasilia)",
        """SELECT s.*, f.offset_h, s.dt_emissao_bu - to_hours(f.offset_h::INT) AS emissao_bsb
           FROM secao s JOIN fuso f USING (uf, cd_municipio)
           WHERE s.dt_bu_recebido < s.dt_emissao_bu - to_hours(f.offset_h::INT)""",
    ),
    "data_fora_do_dia_da_eleicao": (
        "Abertura ou encerramento em data diferente do dia do turno",
        """SELECT * FROM secao
           WHERE (turno = 1 AND (dt_abertura::DATE <> DATE '{d1}' OR dt_encerramento::DATE <> DATE '{d1}'))
              OR (turno = 2 AND (dt_abertura::DATE <> DATE '{d2}' OR dt_encerramento::DATE <> DATE '{d2}'))""".format(
            d1=ELECTION_DAY[1], d2=ELECTION_DAY[2]),
    ),
    "encerramento_antes_das_17h_brasilia": (
        "Urna encerrada antes das 17:00 de Brasilia (horario legal de fim da votacao)",
        """SELECT s.*, f.offset_h, s.dt_encerramento - to_hours(f.offset_h::INT) AS encerramento_bsb
           FROM secao s JOIN fuso f USING (uf, cd_municipio)
           WHERE (s.dt_encerramento - to_hours(f.offset_h::INT))::TIME < TIME '17:00:00'""",
    ),
    "aptos_diferente_entre_turnos": (
        "Mesma secao com numero de aptos diferente no 1o e 2o turno",
        """SELECT a.uf, a.cd_municipio, a.zona, a.secao, a.aptos aptos_1t, b.aptos aptos_2t
           FROM secao a JOIN secao b USING (uf, cd_municipio, zona, secao)
           WHERE a.turno = 1 AND b.turno = 2 AND a.aptos <> b.aptos""",
    ),
    "secao_em_um_turno_so": (
        "Secao presente em apenas um dos turnos (cobertura do 2o turno)",
        """SELECT coalesce(a.uf, b.uf) uf, coalesce(a.cd_municipio, b.cd_municipio) cd_municipio,
                  coalesce(a.zona, b.zona) zona, coalesce(a.secao, b.secao) secao,
                  a.turno IS NOT NULL tem_1t, b.turno IS NOT NULL tem_2t
           FROM (SELECT * FROM secao WHERE turno = 1) a
           FULL JOIN (SELECT * FROM secao WHERE turno = 2) b USING (uf, cd_municipio, zona, secao)
           WHERE a.turno IS NULL OR b.turno IS NULL""",
    ),
    "totalizacao_candidato_bu_vs_oficial": (
        "Soma dos BUs por candidato/zona difere do total oficial do TSE",
        """WITH b AS (
               SELECT turno, uf, cd_municipio, zona, cd_cargo, nr_votavel AS nr_candidato, sum(votos) votos_bu
               FROM bu WHERE cd_tipo_votavel = 1 GROUP BY ALL),
           o AS (
               SELECT turno, uf, cd_municipio, zona, cd_cargo, nr_candidato, sum(votos_nominais) votos_oficial
               FROM oficial_candidato GROUP BY ALL)
           SELECT turno, uf, cd_municipio, zona, cd_cargo, nr_candidato,
                  coalesce(votos_bu, 0) votos_bu, coalesce(votos_oficial, 0) votos_oficial,
                  coalesce(votos_bu, 0) - coalesce(votos_oficial, 0) diferenca
           FROM b FULL JOIN o USING (turno, uf, cd_municipio, zona, cd_cargo, nr_candidato)
           WHERE coalesce(votos_bu, 0) <> coalesce(votos_oficial, 0)""",
    ),
    "totalizacao_zona_bu_vs_oficial": (
        "Comparecimento/brancos/nulos/total por zona e cargo: BU vs detalhe oficial",
        """WITH b AS (
               SELECT turno, uf, cd_municipio, zona, cd_cargo,
                      sum(comparecimento) comparecimento, sum(coalesce(brancos, 0)) brancos,
                      sum(coalesce(nulos, 0)) nulos, sum(votos) votos, count(*) secoes
               FROM secao_cargo GROUP BY ALL),
           o AS (
               SELECT turno, uf, cd_municipio, zona, cd_cargo,
                      sum(comparecimento) comparecimento, sum(brancos) brancos, sum(nulos) nulos,
                      sum(votos) votos, sum(secoes_principais) secoes
               FROM oficial_detalhe GROUP BY ALL)
           SELECT turno, uf, cd_municipio, zona, cd_cargo,
                  b.comparecimento comp_bu, o.comparecimento comp_of,
                  b.brancos brancos_bu, o.brancos brancos_of, b.nulos nulos_bu, o.nulos nulos_of,
                  b.votos votos_bu, o.votos votos_of, b.secoes secoes_bu, o.secoes secoes_of
           FROM b FULL JOIN o USING (turno, uf, cd_municipio, zona, cd_cargo)
           WHERE b.comparecimento IS DISTINCT FROM o.comparecimento OR b.brancos IS DISTINCT FROM o.brancos
              OR b.nulos IS DISTINCT FROM o.nulos OR b.votos IS DISTINCT FROM o.votos""",
    ),
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(BASE / "audit.duckdb"))
    con.execute("SET memory_limit='10GB'")
    if not con.execute("SELECT count(*) FROM duckdb_tables() WHERE table_name = 'secao'").fetchone()[0]:
        con.execute(SETUP)
    only = set(sys.argv[1:])
    rows = []
    for name, (desc, sql) in CHECKS.items():
        if only and name not in only:
            continue
        con.execute(f"COPY ({sql}) TO '{(OUT / (name + '.csv')).as_posix()}' (HEADER, DELIMITER ';')")
        n = con.execute(f"SELECT count(*) FROM ({sql})").fetchone()[0]
        rows.append((name, n, desc))
        print(f"{n:>10,}  {name}", flush=True)
    if not only:
        with open(OUT / "resumo.csv", "w", newline="", encoding="utf-8") as f:
            csv.writer(f, delimiter=";").writerows([("check", "ocorrencias", "descricao"), *rows])


if __name__ == "__main__":
    sys.exit(main())
