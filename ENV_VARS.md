# Variáveis de Ambiente — Remote Access Manager

Crie um arquivo `.env` na raiz do projeto com as variáveis abaixo.
**NUNCA commite o `.env` no Git!** (já está no `.gitignore`)

```env
# ── Banco de Dados ───────────────────────────────────────────
# Neon PostgreSQL (recomendado para produção):
DATABASE_URL=postgresql://neondb_owner:SENHA@ep-bold-darkness-acbc7b9t-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# MySQL local (para desenvolvimento):
# DATABASE_URL=mysql://root:senha@localhost:3306/remote_access_manager

# ── Autenticação JWT ─────────────────────────────────────────
JWT_SECRET=troque-por-uma-chave-secreta-forte-aqui

# ── OAuth Manus ──────────────────────────────────────────────
VITE_APP_ID=seu-app-id-aqui
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
OWNER_OPEN_ID=seu-open-id
OWNER_NAME=Seu Nome

# ── frp (Túnel Reverso) ──────────────────────────────────────
FRP_SERVER_ADDR=seu-servidor.com
FRP_SERVER_PORT=7000
FRP_DASHBOARD_ADDR=127.0.0.1
FRP_DASHBOARD_PORT=7500
FRP_DASHBOARD_USER=admin
FRP_DASHBOARD_PASS=senha-forte-aqui
```
