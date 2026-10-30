"""Convert each downloaded BU zip into a typed Parquet file (one per UF/round)."""
import sys
import zipfile
from pathlib import Path

import duckdb

BASE = Path(__file__).resolve().parent.parent / "data"
RAW = BASE / "raw" / "bweb"
TMP = BASE / "tmp"
OUT = BASE / "parquet" / "bu"

SELECT = """
SELECT
    NR_TURNO::TINYINT AS turno,
    SG_UF AS uf,
    CD_MUNICIPIO::INTEGER AS cd_municipio,
    NM_MUNICIPIO AS nm_municipio,
    NR_ZONA::INTEGER AS zona,
    NR_SECAO::INTEGER AS secao,
    NR_LOCAL_VOTACAO::INTEGER AS local_votacao,
    CD_CARGO_PERGUNTA::INTEGER AS cd_cargo,
    DS_CARGO_PERGUNTA AS ds_cargo,
    NR_PARTIDO::INTEGER AS nr_partido,
    SG_PARTIDO AS sg_partido,
    strptime(DT_BU_RECEBIDO, '%Y-%m-%d %H:%M:%S') AS dt_bu_recebido,
    QT_APTOS::INTEGER AS aptos,
    QT_COMPARECIMENTO::INTEGER AS comparecimento,
    QT_ABSTENCOES::INTEGER AS abstencoes,
    CD_TIPO_URNA::TINYINT AS cd_tipo_urna,
    DS_TIPO_URNA AS ds_tipo_urna,
    CD_TIPO_VOTAVEL::TINYINT AS cd_tipo_votavel,
    DS_TIPO_VOTAVEL AS ds_tipo_votavel,
    NR_VOTAVEL::INTEGER AS nr_votavel,
    NM_VOTAVEL AS nm_votavel,
    QT_VOTOS::INTEGER AS votos,
    NR_URNA_EFETIVADA::INTEGER AS nr_urna,
    CD_CARGA_1_URNA_EFETIVADA AS carga_1,
    CD_CARGA_2_URNA_EFETIVADA AS carga_2,
    CD_FLASHCARD_URNA_EFETIVADA AS flashcard,
    try_strptime(DT_CARGA_URNA_EFETIVADA, '%Y-%m-%d %H:%M:%S') AS dt_carga,
    DS_SECOES_AGREGADAS AS secoes_agregadas,
    try_strptime(DT_ABERTURA, '%Y-%m-%d %H:%M:%S') AS dt_abertura,
    try_strptime(DT_ENCERRAMENTO, '%Y-%m-%d %H:%M:%S') AS dt_encerramento,
    try_cast(QT_ELEI_BIOM_SEM_HABILITACAO AS INTEGER) AS biom_sem_habilitacao,
    try_strptime(DT_EMISSAO_BU, '%Y-%m-%d %H:%M:%S') AS dt_emissao_bu,
    NR_JUNTA_APURADORA::INTEGER AS junta,
    NR_TURMA_APURADORA::INTEGER AS turma
FROM read_csv('{csv}', delim=';', header=true, encoding='latin-1', all_varchar=true, quote='"')
"""


def convert(zpath, con):
    out = OUT / (zpath.stem + ".parquet")
    if out.exists():
        return f"{out.name}: cached"
    with zipfile.ZipFile(zpath) as z:
        name = next(n for n in z.namelist() if n.endswith(".csv"))
        csv = z.extract(name, TMP)
    try:
        con.execute(f"COPY ({SELECT.format(csv=Path(csv).as_posix())}) TO '{out.as_posix()}' (FORMAT parquet, COMPRESSION zstd)")
    finally:
        Path(csv).unlink()
    n = con.execute(f"SELECT count(*) FROM '{out.as_posix()}'").fetchone()[0]
    return f"{out.name}: {n:,} rows"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.execute("SET memory_limit='8GB'")
    for z in sorted(RAW.glob("*.zip")):
        print(convert(z, con), flush=True)


if __name__ == "__main__":
    sys.exit(main())
