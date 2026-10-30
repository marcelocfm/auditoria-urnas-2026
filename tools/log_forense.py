"""Second pass over every urna log (2nd round): signals that would expose votes inserted without real voters.

Per section, on election day:
  * habilitados      - "Eleitor foi habilitado" events (a voter was identified and released to vote)
  * computados       - "O voto do eleitor foi computado" events
  * sem_habilitacao  - votes computed with no voter released since the previous vote
  * por_biometria / por_mesario - how voters were released (fingerprint vs. manual release by the poll worker)
  * gaps             - seconds between consecutive computed votes: count < 10 s, < 20 s, longest run of gaps < 20 s

Usage: python -I tools/log_forense.py <zip> [<zip> ...] -> data/log_forense/<UF>.parquet
"""
import re
import sys
import zipfile
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).resolve().parent))
from urna_audit import ELECTION_DAY, log_texts, open_zip  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "data" / "log_forense"


def analyse(args):
    zip_path, prefix = args
    row = {"prefixo": prefix, "erro": None}
    try:
        z, _ = open_zip(zip_path)
        habilitados = computados = sem_hab = biometria = mesario = 0
        pendentes = 0
        tempos = []
        for text in log_texts(z.read(prefix + "log.jez")):
            for line in text.splitlines():
                p = line.split("\t")
                if len(p) < 5 or not p[0].startswith(ELECTION_DAY):
                    continue
                msg = p[4]
                if msg == "Eleitor foi habilitado":
                    habilitados += 1
                    pendentes += 1
                elif msg == "O voto do eleitor foi computado":
                    computados += 1
                    if pendentes:
                        pendentes -= 1
                    else:
                        sem_hab += 1
                    tempos.append(datetime.strptime(p[0], "%d/%m/%Y %H:%M:%S"))
                elif msg.startswith("Tipo de habilitação do eleitor [biométrica]"):
                    biometria += 1
                elif msg.startswith("Mesário") and msg.endswith("habilitou o eleitor"):
                    mesario += 1
        tempos.sort()
        gaps = [(b - a).total_seconds() for a, b in zip(tempos, tempos[1:])]
        run = best = 0
        for g in gaps:
            run = run + 1 if g < 20 else 0
            best = max(best, run)
        row.update(
            habilitados=habilitados, computados=computados, sem_habilitacao=sem_hab,
            por_biometria=biometria, por_mesario=mesario,
            gaps_10s=sum(g < 10 for g in gaps), gaps_20s=sum(g < 20 for g in gaps),
            maior_sequencia_20s=best, menor_gap=min(gaps) if gaps else None,
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
