"""Per section (2nd round log): how voters were released when the fingerprint failed.

Stores only counts — never the poll worker's voter-ID number, which is personal data.
  * liberados_mesario     - "Mesário <id> habilitou o eleitor" events
  * mesarios_distintos    - how many different poll workers released voters
  * max_por_mesario       - most voters released by a single poll worker in the section
  * manual                - "Solicitação de dado pessoal do eleitor para habilitação manual" (released by birth year)
  * mesario_apos_17h      - poll-worker releases at or after 17:00 local time

Usage: python -I tools/mesario_pass.py <zip> [<zip> ...] -> data/mesario/<UF>.parquet
"""
import collections
import re
import sys
import zipfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).resolve().parent))
from urna_audit import ELECTION_DAY, log_texts, open_zip  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "data" / "mesario"
LIBEROU = re.compile(r"^Mesário (\d+) habilitou o eleitor$")


def analyse(args):
    zip_path, prefix = args
    row = {"prefixo": prefix, "erro": None}
    try:
        z, _ = open_zip(zip_path)
        por_mesario = collections.Counter()
        manual = apos17 = 0
        for text in log_texts(z.read(prefix + "log.jez")):
            for line in text.splitlines():
                p = line.split("\t")
                if len(p) < 5 or not p[0].startswith(ELECTION_DAY):
                    continue
                m = LIBEROU.match(p[4])
                if m:
                    por_mesario[m.group(1)] += 1
                    apos17 += int(p[0][11:13]) >= 17
                elif p[4] == "Solicitação de dado pessoal do eleitor para habilitação manual":
                    manual += 1
        row.update(
            liberados_mesario=sum(por_mesario.values()), mesarios_distintos=len(por_mesario),
            max_por_mesario=max(por_mesario.values(), default=0), manual=manual, mesario_apos_17h=apos17,
        )
    except Exception as e:
        row["erro"] = f"{type(e).__name__}: {e}"[:300]
    return row


def run(zip_path):
    zip_path = Path(zip_path)
    uf = re.search(r"_2t_([A-Z]{2})\.zip$", zip_path.name).group(1)
    out = OUT / f"{uf}.parquet"
    if out.exists():
        print(f"{uf}: cached", flush=True)
        return
    with zipfile.ZipFile(zip_path) as z:
        prefixes = sorted(n[:-7] for n in z.namelist() if n.endswith("-log.jez"))
    with ProcessPoolExecutor(14) as pool:
        rows = list(pool.map(analyse, [(str(zip_path), p) for p in prefixes], chunksize=64))
    for r in rows:
        r["uf"] = uf
    pq.write_table(pa.Table.from_pylist(rows), out)
    print(f"{uf}: {len(rows)} logs, {sum(1 for r in rows if r['erro'])} erros", flush=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for path in sys.argv[1:]:
        run(path)
