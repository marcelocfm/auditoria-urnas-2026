"""Convert TSE official totals (candidate and detail per municipality/zone) to Parquet."""
import shutil
import sys
import zipfile
from pathlib import Path

import duckdb

BASE = Path(__file__).resolve().parent.parent / "data"
RAW = BASE / "raw" / "oficial"
TMP = BASE / "tmp" / "oficial"
OUT = BASE / "parquet"

CANDIDATO = """
SELECT DISTINCT
    NR_TURNO::TINYINT AS turno, SG_UF AS uf, CD_MUNICIPIO::INTEGER AS cd_municipio,
    NR_ZONA::INTEGER AS zona, CD_CARGO::INTEGER AS cd_cargo, SQ_CANDIDATO AS sq_candidato,
    NR_CANDIDATO::INTEGER AS nr_candidato, NM_URNA_CANDIDATO AS nm_urna, SG_PARTIDO AS sg_partido,
    ST_VOTO_EM_TRANSITO AS transito, QT_VOTOS_NOMINAIS::BIGINT AS votos_nominais,
    NM_TIPO_DESTINACAO_VOTOS AS destinacao, QT_VOTOS_NOMINAIS_VALIDOS::BIGINT AS votos_validos,
    DS_SIT_TOT_TURNO AS situacao
FROM read_csv('{glob}', delim=';', header=true, encoding='latin-1', all_varchar=true, union_by_name=true)
"""

DETALHE = """
SELECT DISTINCT
    NR_TURNO::TINYINT AS turno, SG_UF AS uf, CD_MUNICIPIO::INTEGER AS cd_municipio,
    NR_ZONA::INTEGER AS zona, CD_CARGO::INTEGER AS cd_cargo, ST_VOTO_EM_TRANSITO AS transito,
    QT_APTOS::BIGINT AS aptos, QT_SECOES_PRINCIPAIS::INTEGER AS secoes_principais,
    QT_SECOES_AGREGADAS::INTEGER AS secoes_agregadas, QT_SECOES_NAO_INSTALADAS::INTEGER AS secoes_nao_instaladas,
    QT_TOTAL_SECOES::INTEGER AS total_secoes, QT_COMPARECIMENTO::BIGINT AS comparecimento,
    QT_ELEITORES_SECOES_NAO_INSTALADAS::BIGINT AS eleitores_nao_instaladas, QT_ABSTENCOES::BIGINT AS abstencoes,
    QT_VOTOS::BIGINT AS votos, QT_TOTAL_VOTOS_VALIDOS::BIGINT AS validos,
    QT_VOTOS_NOMINAIS_VALIDOS::BIGINT AS nominais_validos, QT_TOTAL_VOTOS_LEG_VALIDOS::BIGINT AS legenda_validos,
    QT_TOTAL_VOTOS_ANULADOS::BIGINT AS anulados, QT_TOTAL_VOTOS_ANUL_SUBJUD::BIGINT AS anulados_subjudice,
    QT_VOTOS_BRANCOS::BIGINT AS brancos, QT_TOTAL_VOTOS_NULOS::BIGINT AS total_nulos,
    QT_VOTOS_NULOS::BIGINT AS nulos, QT_VOTOS_NULOS_TECNICOS::BIGINT AS nulos_tecnicos,
    QT_VOTOS_ANULADOS_APU_SEP::BIGINT AS anulados_apuracao_separada
FROM read_csv('{glob}', delim=';', header=true, encoding='latin-1', all_varchar=true, union_by_name=true)
"""


def convert(con, zip_name, query, out_name):
    dest = TMP / zip_name
    shutil.rmtree(dest, ignore_errors=True)
    with zipfile.ZipFile(RAW / f"{zip_name}.zip") as z:
        # *_BRASIL.csv repeats every UF file; per-UF plus *_BR.csv (president) cover everything
        names = [n for n in z.namelist() if n.endswith(".csv") and not n.endswith("_BRASIL.csv")]
        z.extractall(dest, names)
    out = OUT / f"{out_name}.parquet"
    con.execute(f"COPY ({query.format(glob=(dest / '*.csv').as_posix())}) TO '{out.as_posix()}' (FORMAT parquet)")
    shutil.rmtree(dest)
    n = con.execute(f"SELECT count(*) FROM '{out.as_posix()}'").fetchone()[0]
    print(f"{out.name}: {n:,} rows", flush=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    convert(con, "votacao_candidato_munzona_2026", CANDIDATO, "oficial_candidato")
    convert(con, "detalhe_votacao_munzona_2026", DETALHE, "oficial_detalhe")


if __name__ == "__main__":
    sys.exit(main())
