"""One state at a time: download the 2nd-round machine package, check its SHA-512 against our manifest,
verify signatures, extract log errors and target stations, then delete the package.

Usage: python -I scripts/verificar_estados.py UF [UF ...]
"""
import csv
import hashlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = sys.executable
PASTA = ROOT / "data" / "raw" / "urna_2t"
MANIFESTO = {r["arquivo"]: r["sha512"] for r in csv.DictReader(open(ROOT / "data" / "manifesto_urna.csv", encoding="utf-8"), delimiter=";")}


def sha512(path):
    h = hashlib.sha512()
    with open(path, "rb") as f:
        while chunk := f.read(1 << 24):
            h.update(chunk)
    return h.hexdigest()


def run(*args):
    subprocess.run([PY, "-I", "-X", "utf8", *map(str, args)], check=True)


def main():
    for uf in sys.argv[1:]:
        nome = f"bu_imgbu_logjez_rdv_vscmr_2026_2t_{uf}.zip"
        zip_path = PASTA / nome
        run(ROOT / "scripts" / "download.py", "urna", "2", uf)
        igual = sha512(zip_path) == MANIFESTO[nome]
        print(f"{uf}: sha512 {'IGUAL ao manifesto' if igual else 'DIFERENTE do manifesto'}", flush=True)
        for tool in ("assinatura_audit.py", "log_erros.py", "secoes_alvo.py"):
            run(ROOT / "tools" / tool, zip_path)
        if igual:
            zip_path.unlink()
        else:
            print(f"{uf}: pacote mantido em disco para análise (hash diferente)", flush=True)


if __name__ == "__main__":
    sys.exit(main())
