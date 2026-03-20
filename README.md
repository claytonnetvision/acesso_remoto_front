# RemoteManager — Sistema de Acesso Remoto

> **Banco de dados:** PostgreSQL (Neon) — schema já aplicado e validado.

Sistema web para gerenciamento centralizado de acesso remoto a servidores Windows via RDP, com suporte a túnel reverso (estilo AnyDesk) usando frp.

---

## Estrutura do Projeto

```
remote-access-manager/
├── client/                  # Frontend React + TypeScript + Tailwind
│   ├── src/
│   │   ├── pages/           # Páginas da aplicação
│   │   ├── components/      # Componentes reutilizáveis (DashboardLayout, shadcn/ui)
│   │   └── App.tsx          # Rotas
│   └── index.html
├── server/                  # Backend Node.js + Express + tRPC
│   ├── routers/
│   │   └── frp.ts           # Gerenciamento de túneis frp
│   ├── routers.ts           # Router principal (clientes, servidores, credenciais, logs, RDP)
│   ├── db.ts                # Helpers de banco de dados (PostgreSQL/Drizzle)
│   └── _core/               # Infraestrutura (auth, OAuth, JWT, etc.)
├── drizzle/
│   └── schema.ts            # Schema PostgreSQL (7 tabelas + 4 enums)
├── shared/                  # Tipos e constantes compartilhados
├── ENV_VARS.md              # Guia de variáveis de ambiente
├── package.json
└── README.md
```

---

## Pré-requisitos

- **Node.js** 18+ ([nodejs.org](https://nodejs.org))
- **pnpm** (`npm install -g pnpm`)
- Conta no **Neon** (banco já configurado)

---

## Instalação Local (Windows / VS Code)

### 1. Extrair e abrir no VS Code

```bash
code C:\Users\robson.clayton\Documents\Projetos\Acesso_remoto\remote-access-manager
```

### 2. Instalar dependências

```bash
pnpm install
```

### 3. Criar o arquivo `.env`

Crie um arquivo `.env` na raiz do projeto:

```env
# ── Banco de Dados Neon PostgreSQL ───────────────────────────
DATABASE_URL=postgresql://neondb_owner:npg_zhXcb6DV9RTj@ep-bold-darkness-acbc7b9t-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# ── Autenticação JWT ─────────────────────────────────────────
JWT_SECRET=remote-manager-secret-2024-forte

# ── OAuth Manus (para login) ─────────────────────────────────
VITE_APP_ID=local-dev
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
OWNER_OPEN_ID=local-admin
OWNER_NAME=Admin

# ── frp (Túnel Reverso) ──────────────────────────────────────
FRP_SERVER_ADDR=seu-servidor.com
FRP_SERVER_PORT=7000
FRP_DASHBOARD_PORT=7500
FRP_DASHBOARD_USER=admin
FRP_DASHBOARD_PASS=senha-forte
```

> O banco Neon já tem todas as tabelas criadas. Não é necessário rodar migrations.

### 4. Rodar em desenvolvimento

```bash
pnpm dev
```

Acesse: **http://localhost:3000**

---

## Banco de Dados (Neon PostgreSQL)

O schema foi aplicado diretamente no seu banco Neon. As seguintes tabelas foram criadas:

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários do sistema (admin/user) |
| `clients` | Clientes cadastrados |
| `servers` | Servidores Windows por cliente |
| `credentials` | Credenciais de acesso (criptografadas AES-256) |
| `important_links` | Links importantes por cliente/servidor |
| `server_permissions` | Permissões de acesso por usuário |
| `access_logs` | Logs de auditoria de todas as ações |

---

## Páginas Disponíveis

| Rota | Descrição |
|------|-----------|
| `/` | Dashboard com estatísticas |
| `/clients` | Cadastro e gerenciamento de clientes |
| `/servers` | Servidores Windows (status online/offline, CRUD) |
| `/credentials` | Credenciais de acesso (criptografadas, reveal com log) |
| `/links` | Links importantes por cliente/servidor |
| `/agent/:id` | Configuração e download do agente frpc para Windows |
| `/rdp/:id` | Tela de conexão RDP (via túnel ou direto) |
| `/permissions` | Permissões de acesso por usuário (admin) |
| `/users` | Usuários do sistema (admin) |
| `/logs` | Logs de auditoria |

---

## Arquitetura do Túnel Reverso (frp)

```
[Windows Server do Cliente]
    └── frpc.exe (agente instalado como serviço Windows)
         └── conecta via TCP porta 7000 →

[Seu Servidor / Render / VPS]
    └── frps (servidor de túnel)
         └── expõe porta RDP remota (ex: 20001, 20002...)

[Painel Web — RemoteManager]
    └── gera frpc.toml + install.bat personalizados por servidor
    └── monitora status via frps dashboard API (porta 7500)
    └── botão "Conectar" → abre mstsc com a porta do túnel
```

### Instalar o frps no servidor

1. Baixe o frp: https://github.com/fatedier/frp/releases
2. Crie `frps.toml`:

```toml
bindPort = 7000

[webServer]
addr = "127.0.0.1"
port = 7500
user = "admin"
password = "sua-senha-forte"
```

3. Rode: `./frps -c frps.toml`
4. Configure as variáveis `FRP_*` no `.env`

### Instalar o agente nos clientes Windows

1. No painel, vá em **Servidores** → clique em **Agente** no servidor
2. Clique em **Gerar Configuração**
3. Baixe o `frpc.exe` e coloque na mesma pasta do arquivo gerado
4. Execute `install.bat` como **Administrador**
5. O servidor aparecerá **Online** no painel em até 30 segundos

---

## Deploy no Render

1. Faça push para o GitHub
2. Crie um **Web Service** no Render apontando para o repositório
3. Configure as variáveis de ambiente no painel do Render
4. O Render usa automaticamente:
   - **Build:** `pnpm install && pnpm build`
   - **Start:** `node dist/index.js`

> **Nota:** O frps precisa de um VPS separado (porta TCP 7000), pois o Render não suporta portas TCP arbitrárias no plano gratuito.

---

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend | Node.js, Express 4, tRPC 11 |
| Banco | PostgreSQL via Neon (Drizzle ORM) |
| Auth | Manus OAuth + JWT |
| Túnel | frp (Fast Reverse Proxy) |
| Criptografia | AES-256-CBC (senhas) |
| Testes | Vitest — 23 testes passando |

---

## Suporte

Projeto desenvolvido com Manus AI.
