"""Download TSE 2026 ballot-box reports (BU CSV) and official totals, verifying SHA-512."""
import hashlib
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "data" / "raw"
CKAN = "https://dadosabertos.tse.jus.br/api/3/action/package_search?q=name:{}&rows=1"

OFFICIAL = [
    "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2026.zip",
    "https://cdn.tse.jus.br/estatistica/sead/odsele/detalhe_votacao_munzona/detalhe_votacao_munzona_2026.zip",
]


def resources(package):
    with urllib.request.urlopen(CKAN.format(package), timeout=60) as r:
        return [x["url"] for x in json.load(r)["result"]["results"][0]["resources"]]


def fetch(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(req, timeout=60) as r:
        size = r.headers.get("Content-Length")
    if dest.exists() and (size is None or dest.stat().st_size == int(size)):
        return dest, "cached"
    tmp = dest.with_suffix(dest.suffix + ".part")
    have = tmp.stat().st_size if tmp.exists() else 0
    req = urllib.request.Request(url, headers={"Range": f"bytes={have}-"} if have else {})
    with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "ab" if have else "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    tmp.replace(dest)
    return dest, "downloaded"


def sha512(path):
    h = hashlib.sha512()
    with open(path, "rb") as f:
        while chunk := f.read(1 << 22):
            h.update(chunk)
    return h.hexdigest()


def job(url, folder):
    try:
        return _job(url, folder)
    except Exception as e:
        return f"{url}: FAILED {e!r}"


def _job(url, folder):
    name = url.rsplit("/", 1)[1]
    dest, status = fetch(url, ROOT / folder / name)
    if not name.endswith(".zip"):
        return f"{name}: {status}"
    hash_url = url + ".sha512"
    try:
        hdest, _ = fetch(hash_url, ROOT / folder / (name + ".sha512"))
        expected = hdest.read_text().split()[0].lower()
        ok = sha512(dest) == expected
        return f"{name}: {status}, sha512 {'OK' if ok else 'MISMATCH'}"
    except urllib.error.HTTPError:
        return f"{name}: {status}, no published hash"


def main():
    if sys.argv[1:] == ["urna"]:
        # raw ballot-box files (signed BU, RDV, logs): second round only, ~124 GB
        urls = [(u, "urna") for u in resources("resultados-2026-arquivos-transmitidos-para-totalizacao")
                if u.endswith(".zip") and "_2t_" in u]
        urls.sort(key=lambda a: "_SP." in a[0])  # biggest last so smaller UFs are ready first
    else:
        urls = [(u, "bweb") for u in resources("resultados-2026-boletim-de-urna") if u.endswith(".zip")]
        urls += [(u, "oficial") for u in OFFICIAL]
    with ThreadPoolExecutor(4) as pool:
        for line in pool.map(lambda a: job(*a), urls):
            print(line, flush=True)


if __name__ == "__main__":
    sys.exit(main())
