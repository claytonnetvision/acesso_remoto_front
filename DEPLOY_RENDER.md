# Deploy no Render — Remote Access Manager

## Arquitetura do Sistema

```
[Navegador / Usuário]
        │
        ▼
[Render — Painel Web]          ← Este deploy
  Frontend React + Backend API
  URL: https://seu-app.onrender.com
        │
        ├──► [Neon PostgreSQL]  ← Banco de dados na nuvem (já configurado)
        │
        └──► [VPS Hostinger]   ← frps já instalado e rodando
               IP: 31.97.16.12
               Porta 7000 (túneis frp)
               Porta 7500 (dashboard frps)
               Portas 20000-29999 (RDP por túnel)
                      ▲
                      │ túnel reverso
               [Agente frpc no Windows Server]
                  C:\RemoteAccessAgent\frpc.exe
```

---

## Pré-requisitos

- Conta no [Render](https://render.com) (plano Free funciona)
- Repositório GitHub com o código do projeto
- Banco Neon já configurado (string de conexão disponível)
- VPS Hostinger com frps rodando (já configurado)

---

## Passo 1 — Subir o código para o GitHub

Se ainda não fez, inicialize o repositório e faça o push:

```bash
cd remote-access-manager
git init
git add .
git commit -m "feat: Remote Access Manager v1.0"
git remote add origin https://github.com/SEU_USUARIO/remote-access-manager.git
git push -u origin main
```

> Se já tem o repositório `acesso_remoto_front`, pode usar ele mesmo.

---

## Passo 2 — Criar o serviço no Render

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Clique em **"New +"** → **"Web Service"**
3. Conecte seu repositório GitHub
4. Configure:
   - **Name:** `remote-access-manager`
   - **Region:** `Oregon (US West)` ou `Frankfurt (EU Central)`
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `pnpm install --frozen-lockfile && pnpm build:render`
   - **Start Command:** `node dist/index.js`
   - **Plan:** `Free`

---

## Passo 3 — Configurar as Variáveis de Ambiente

No Render, vá em **Environment** e adicione as seguintes variáveis:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `NEON_DATABASE_URL` | `postgresql://neondb_owner:npg_zhXcb6DV9RTj@ep-bold-darkness-acbc7b9t-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |
| `JWT_SECRET` | *(gerar um valor aleatório — use o botão "Generate" do Render)* |
| `VITE_APP_ID` | `remote-access-manager` |
| `VITE_APP_TITLE` | `Remote Access Manager` |
| `OWNER_OPEN_ID` | `local` |
| `OWNER_NAME` | `Admin` |
| `OAUTH_SERVER_URL` | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | `https://manus.im` |
| `FRP_SERVER_ADDR` | `31.97.16.12` |
| `FRP_SERVER_PORT` | `7000` |
| `FRP_SERVER_PROTOCOL` | `tcp` |
| `FRP_DASHBOARD_ADDR` | `31.97.16.12` |
| `FRP_DASHBOARD_PORT` | `7500` |
| `FRP_DASHBOARD_USER` | `admin` |
| `FRP_DASHBOARD_PASS` | `AdminFrps@2024` |

> **IMPORTANTE:** O `NEON_DATABASE_URL` já está preenchido acima com os dados do seu banco.
> Copie exatamente como está.

---

## Passo 4 — Deploy

1. Clique em **"Create Web Service"**
2. Aguarde o build (5-10 minutos na primeira vez)
3. Quando aparecer **"Live"**, acesse a URL gerada

---

## Passo 5 — Primeiro Acesso

Acesse `https://seu-app.onrender.com/login` e faça login com:
- **Usuário:** `admin`
- **Senha:** `admin123`

> O usuário admin já está criado no banco Neon.

---

## Passo 6 — Reinstalar o Agente nos Servidores Windows

Após o deploy, o endereço do painel mudou. Para cada servidor Windows:

1. No painel, vá em **Servidores → [Servidor] → Agente/Túnel**
2. Clique em **"Baixar Pacote do Agente"**
3. No Windows Server, execute como Administrador:
   ```batch
   sc stop RemoteAccessAgent
   sc delete RemoteAccessAgent
   ```
4. Copie o novo `frpc.toml` para `C:\RemoteAccessAgent\`
5. Execute `install.bat` como Administrador

O `frpc.toml` gerado já aponta para `31.97.16.12:7000` (VPS Hostinger).

---

## Verificação do Sistema

Após instalar o agente, no painel clique em **"Verificar Túneis"** no Dashboard.
O servidor deve aparecer como **Online** em até 30 segundos.

### Verificar frps na VPS manualmente:
```bash
ssh root@31.97.16.12
systemctl status frps
journalctl -u frps -n 20
```

### Dashboard frps:
Acesse `http://31.97.16.12:7500` com usuário `admin` / senha `AdminFrps@2024`

---

## Configuração do Render — Observações Importantes

### Plano Free do Render
- O serviço **dorme após 15 minutos** de inatividade
- O primeiro acesso após dormir pode demorar 30-60 segundos
- Para evitar isso, considere o plano **Starter ($7/mês)**

### Variável `NEON_DATABASE_URL` vs `DATABASE_URL`
O projeto usa `NEON_DATABASE_URL` (não `DATABASE_URL`) para evitar conflito
com o banco MySQL padrão. **Não use `DATABASE_URL`** — use `NEON_DATABASE_URL`.

---

## Estrutura de Arquivos Importantes

```
remote-access-manager/
├── render.yaml              ← Configuração do Render (Blueprint)
├── DEPLOY_RENDER.md         ← Este guia
├── seed-admin.mjs           ← Script para criar usuário admin no Neon
├── server/
│   ├── db.ts                ← Conexão com Neon PostgreSQL
│   ├── routers/frp.ts       ← Geração de config do agente frpc
│   └── _core/localAuth.ts   ← Login local (admin/admin123)
├── drizzle/schema.ts        ← Schema do banco de dados
└── frps-render/             ← (Não usado — frps está na VPS)
```

---

## Suporte

- **frps na VPS:** `ssh root@31.97.16.12` (senha: M@ch1nes@rob)
- **Banco Neon:** https://console.neon.tech
- **Render:** https://dashboard.render.com
