# Site Público — Auditoria Presidencial 2026 (`auditoria-urnas-2026`)

Interface estática de consulta pública da auditoria independente da eleição presidencial de 2026 (Lula × Flávio Bolsonaro).

- **Dados / Pipeline Backend (`public/data/*.json`):** Gerados pelo **Claude** (`scripts/` e `tools/`).
- **Engenharia de Frontend, UX Brutalista & Performance (`src/`):** Aprimorados pelo **AGY (Antigravity)**.

## Comandos

```powershell
npm run dev      # Servidor local Vite
npm run lint     # Verificação estática Oxlint
npm run build    # Typecheck (tsc -b) + bundle de produção em dist/
vercel --prod    # Deploy de produção na Vercel
```
