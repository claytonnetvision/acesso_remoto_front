# frps-render — Servidor de Túnel para Render

Este diretório contém o **servidor frps** configurado para rodar no **Render (gratuito)** usando WebSocket sobre HTTPS.

## Como funciona

```
[Windows Server do Cliente]
  frpc.exe (agente) → WSS → [Render frps] → painel consulta status
```

O Render fornece HTTPS automaticamente. O frpc conecta via WebSocket Secure (WSS) na porta 443 — sem precisar de VPS ou porta TCP aberta.

## Deploy no Render

### Passo 1 — Criar repositório GitHub

Crie um repositório **separado** só para o frps:
```
https://github.com/SEU_USUARIO/remote-access-frps
```

Copie os arquivos desta pasta (`Dockerfile`, `entrypoint.sh`, `render.yaml`) para esse repositório.

### Passo 2 — Criar Web Service no Render

1. Acesse [render.com](https://render.com) e faça login
2. Clique em **"New +"** → **"Web Service"**
3. Conecte ao repositório `remote-access-frps`
4. Configure:
   - **Name:** `remote-access-frps`
   - **Runtime:** Docker
   - **Plan:** Free
5. Clique em **"Create Web Service"**

### Passo 3 — Configurar variáveis de ambiente

No painel do Render, vá em **Environment** e adicione:

| Variável | Valor |
|----------|-------|
| `FRP_TOKEN` | Uma senha forte (ex: `MinhaChave2024!`) |
| `FRP_DASHBOARD_USER` | `admin` |
| `FRP_DASHBOARD_PASS` | Uma senha para o dashboard |

> **Anote o FRP_TOKEN** — você vai precisar dele no `.env` do painel e no `frpc.toml` dos agentes.

### Passo 4 — Obter a URL do serviço

Após o deploy, o Render fornece uma URL como:
```
https://remote-access-frps.onrender.com
```

### Passo 5 — Atualizar o .env do painel

No projeto principal (painel web), atualize o `.env`:

```env
FRP_SERVER_ADDR=remote-access-frps.onrender.com
FRP_SERVER_PORT=443
FRP_SERVER_PROTOCOL=wss
FRP_TOKEN=MinhaChave2024!
FRP_DASHBOARD_ADDR=remote-access-frps.onrender.com
FRP_DASHBOARD_PORT=443
FRP_DASHBOARD_USER=admin
FRP_DASHBOARD_PASS=SuaSenhaAdmin
```

### Passo 6 — Atualizar o frpc.toml dos agentes

O painel vai gerar automaticamente o `frpc.toml` com `transport.protocol = "wss"` para cada servidor.

## Limitação do Render Free

O Render gratuito "dorme" após **15 minutos sem requisições HTTP**. Isso significa que:
- O frps pode ficar offline se não houver conexões ativas
- Os agentes tentam reconectar automaticamente a cada 30 segundos
- Para uso contínuo, considere o plano pago do Render (~$7/mês)

## Verificar se está funcionando

Após o deploy, acesse:
```
https://remote-access-frps.onrender.com
```

Se retornar qualquer resposta (mesmo erro 400/404), o frps está rodando.
