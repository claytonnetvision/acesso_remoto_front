#!/bin/bash
set -e

# Variáveis de ambiente com defaults
FRP_TOKEN="${FRP_TOKEN:-remote-manager-secret-2024}"
FRP_DASHBOARD_USER="${FRP_DASHBOARD_USER:-admin}"
FRP_DASHBOARD_PASS="${FRP_DASHBOARD_PASS:-admin123}"
# Render usa a variável PORT para a porta HTTP principal
PORT="${PORT:-7000}"

echo "[frps] Starting with port=$PORT token=***"

# Gerar frps.toml dinamicamente
cat > /tmp/frps.toml << EOF
# frps.toml - gerado automaticamente pelo entrypoint
bindPort = ${PORT}

# Autenticação por token
auth.method = "token"
auth.token = "${FRP_TOKEN}"

# Transport: habilitar WebSocket para funcionar atrás do proxy HTTPS do Render
# O Render faz TLS termination e encaminha como HTTP/WebSocket para o container
transport.tcpMux = true
transport.tcpMuxKeepaliveInterval = 30

# Aceitar conexões via websocket (o frpc usa wss externamente, o Render converte para ws internamente)
webServer.addr = "0.0.0.0"
webServer.port = ${PORT}
webServer.user = "${FRP_DASHBOARD_USER}"
webServer.password = "${FRP_DASHBOARD_PASS}"

# Portas permitidas para túneis RDP
allowPorts = [
  { start = 20000, end = 29999 }
]

# Log
log.level = "info"
log.maxDays = 3
EOF

echo "[frps] Configuration:"
cat /tmp/frps.toml

echo "[frps] Starting frps server..."
exec /usr/local/bin/frps -c /tmp/frps.toml
