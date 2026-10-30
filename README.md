# Auditoria Independente — Eleição Presidencial 2026 (Lula × Flávio Bolsonaro)

Auditoria técnica, apartidária e 100% reproduzível da contagem de votos para Presidente da República em 2026 (1º e 2º turnos), confrontando **todos os Boletins de Urna (BUs)**, **Registros Digitais do Voto (RDVs)**, **imagens de boletins impressos (`imgbu`)** e **logs de urna (`log.jez`)** publicados pelo TSE contra os totais oficiais de apuração.

- **Site público (Produção):** https://auditoria-urnas-2026.vercel.app

---

## Divisão de Responsabilidades (Arquitetura Multi-Agente)

Este projeto opera com divisão explícita de papéis entre dois agentes de engenharia:

- **Claude (Engenharia de Dados, Pipeline Criptográfico & Backend Forense):**
  - Responsável pela ingestão integral dos pacotes brutos do Portal de Dados Abertos do TSE (`scripts/download.py`), validação de hashes `SHA-512` e conversão colunar em Parquet/DuckDB (`scripts/build.py`, `scripts/oficial.py`).
  - Execução das checagens de consistência eleitoral (`scripts/audit.py`), séries de alegações públicas (`tools/claims_export.py`) e decodificação binária ASN.1 BER/DER dos pacotes brutos das urnas (`spec2026/`, `tools/der.py`, `tools/urna_audit.py`, `tools/urna_report.py`), exportando os artefatos estáticos auditados em `site/public/data/`.

- **AGY / Antigravity (Revisão Forense Cruzada & Engenharia de Frontend):**
  - Responsável pelas melhorias de arquitetura, performance, precisão matemática de visualização e UX brutalista do frontend em `site/` (React 19 + TypeScript 7 + Tailwind CSS v4 + Vite 8).
  - Indexação em memória `O(1)` de ~500 mil seções eleitorais sem travamento mobile (`SectionLookup.tsx`), ordenação colacionada `pt-BR`, links diretos compartilháveis por seção, separação contra cancelamento algébrico nas tabelas estaduais, renderização das auditorias de geração de hardware (`UE2009–UE2020+`) e ritmo horário de votação (`Investigacao.tsx`, `MarginChart.tsx`, `App.tsx`).

---

## Estrutura do Repositório

```text
├── scripts/
│   ├── download.py        # Download dos BUs (1T/2T) e totais oficiais + validação SHA-512
│   ├── build.py           # Conversão dos CSVs de Boletim de Urna para Parquet tipado (ZSTD)
│   ├── oficial.py         # Conversão dos arquivos oficiais por município/zona para Parquet
│   ├── audit.py           # 17 checagens SQL/DuckDB de consistência interna e reconciliação
│   └── export_site.py     # Exportação de auditoria.json e arquivos compactos por UF
├── spec2026/              # Gramáticas ASN.1 adaptadas para os pacotes binários 2026 (BU, RDV, Assinatura)
├── tools/
│   ├── der.py             # Leitor binário TLV DER/BER sem dependência externa
│   ├── urna_audit.py      # Recontagem voto a voto de RDV, imgbu, hashes .vsc e logs por seção
│   ├── urna_report.py     # Consolidação nacional das 499.207 urnas em urnas.json
│   └── claims_export.py   # Séries temporais de apuração, horário de encerramento e transferência 1T→2T
└── site/                  # Aplicação web estática (React + TypeScript + Tailwind v4)
```

---

## Como Reproduzir do Zero

### 1. Pipeline de Dados e Recontagem (Python + DuckDB)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install duckdb pyarrow asn1tools

python scripts/download.py
python scripts/build.py
python scripts/oficial.py
python scripts/audit.py
python scripts/export_site.py
python tools/claims_export.py
python tools/urna_report.py
```

### 2. Frontend e Build de Produção

```powershell
cd site
npm install
npm run lint
npm run build
```
