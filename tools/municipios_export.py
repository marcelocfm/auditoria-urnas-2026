"""Exporta índice compacto { UF: [municipios...] } a partir de site/public/data/secoes/*.json."""

from __future__ import annotations

import json
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SECOES_DIR = ROOT / "site" / "public" / "data" / "secoes"
OUT_FILE = ROOT / "site" / "public" / "data" / "municipios.json"


def sort_key(nome: str) -> str:
    nfkd = unicodedata.normalize("NFKD", nome)
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch)).upper()


def main() -> None:
    por_uf: dict[str, list[str]] = {}
    total = 0
    for path in sorted(SECOES_DIR.glob("*.json")):
        uf = path.stem.upper()
        payload = json.loads(path.read_text(encoding="utf-8"))
        mun_idx = payload["colunas"].index("municipio")
        nomes = sorted({str(row[mun_idx]) for row in payload["linhas"]}, key=sort_key)
        por_uf[uf] = nomes
        total += len(nomes)

    OUT_FILE.write_text(json.dumps(por_uf, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Exportados {total} municipios em {len(por_uf)} UFs -> {OUT_FILE} ({OUT_FILE.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
