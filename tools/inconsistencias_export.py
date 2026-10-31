"""Error events from the machine logs (election day only) grouped for the Inconsistencies page -> site/public/data/inconsistencias.json."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOGS = ROOT / "data" / "urna_audit"
OUT = ROOT / "site" / "public" / "data" / "inconsistencias.json"

# substring of the log event -> group shown on the site
GRUPOS = [
    ("voto_nao_registrado", ["O voto do eleitor NÃO foi registrado"]),
    ("assinatura", ["verificação de assinatura", "verificando assinatura", "validar assinatura", "validação de assinatura",
                    "Erro na assinatura", "Erro ao inicializar assinatura", "integridade do sistema"]),
    ("dados_inconsistentes", ["não correspondem aos dados", "inconsistente na mídia"]),
    ("gravacao_rdv", ["Erro gravando RDV"]),
    ("leitor_digital", ["biometric reader", "image acquisition", "/dev/uescan", "CFingerScanner", "Leitor nao encontrado",
                        "Falha na captura da digital", "decifrar a biometria"]),
    ("limite_mesarios", ["Limite de mesários registrados atingido"]),
]


def main():
    eventos = {}
    for f in LOGS.glob("*_log.json"):
        for k, n in json.loads(f.read_text(encoding="utf-8")):
            eventos[k] = eventos.get(k, 0) + n
    grupos = {}
    for nome, chaves in GRUPOS:
        itens = sorted(((k, n) for k, n in eventos.items() if any(c in k for c in chaves)), key=lambda x: -x[1])
        grupos[nome] = {"ocorrencias": sum(n for _, n in itens),
                        "eventos": [{"evento": k.split("|", 2)[2][:160], "ocorrencias": n} for k, n in itens[:8]]}
    OUT.write_text(json.dumps(grupos, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v["ocorrencias"] for k, v in grupos.items()}, ensure_ascii=False))


if __name__ == "__main__":
    sys.exit(main())
