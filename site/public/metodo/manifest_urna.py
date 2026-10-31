"""SHA-512 manifest of the raw ballot-box packages, so they can be deleted and re-verified after a fresh download."""
import csv
import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "raw" / "urna"
OUT = ROOT / "data" / "manifesto_urna.csv"
BASE = "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/arqurnatot/"


def sha512(path):
    h = hashlib.sha512()
    with open(path, "rb") as f:
        while chunk := f.read(1 << 24):
            h.update(chunk)
    return h.hexdigest()


def main():
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["pasta", "arquivo", "bytes", "sha512", "url"])
        for p in sorted(SRC.glob("*.zip")):
            w.writerow(["urna", p.name, p.stat().st_size, sha512(p), BASE + p.name])
            f.flush()
            print(p.name, flush=True)


if __name__ == "__main__":
    sys.exit(main())
