# Remote Access Manager - TODO

## Banco de Dados / Schema
- [x] Tabela clients (clientes)
- [x] Tabela servers (servidores Windows)
- [x] Tabela credentials (credenciais de acesso)
- [x] Tabela access_logs (logs de auditoria)
- [x] Tabela server_permissions (permissões por usuário/servidor)
- [x] Tabela important_links (links importantes por cliente)

## Backend (tRPC Routers)
- [x] Router: clients (CRUD completo)
- [x] Router: servers (CRUD + status ping)
- [x] Router: credentials (CRUD com criptografia AES-256)
- [x] Router: accessLogs (listar, filtrar)
- [x] Router: permissions (atribuir/revogar acesso)
- [x] Router: dashboard (estatísticas gerais)
- [x] Router: rdp (iniciar sessão RDP + download .rdp)

## Frontend - Tema e Layout
- [x] Tema escandinavo (cinza frio, azul pastel, rosa blush)
- [x] DashboardLayout com sidebar redimensionável
- [x] Tipografia bold/thin hierárquica (DM Sans + Inter)

## Frontend - Páginas
- [x] Dashboard (visão geral, cards de stats, conexões recentes)
- [x] Clientes (lista, busca, filtros, CRUD)
- [x] Servidores (lista, status online/offline, CRUD)
- [x] Credenciais (gerenciamento seguro, mascaramento, reveal)
- [x] Conexão RDP (interface de acesso + download .rdp)
- [x] Logs de Auditoria (tabela com filtros)
- [x] Permissões (gerenciar acesso por usuário)
- [x] Links Importantes (CRUD com categorias)
- [x] Usuários (lista de usuários do sistema)

## Funcionalidades Especiais
- [x] Monitoramento de status dos servidores (manual)
- [x] Busca global de clientes e servidores
- [x] Controle de roles (admin/user) nas rotas
- [x] Download de arquivo .rdp configurado
- [x] Indicadores visuais de status (online/offline/manutenção)
- [x] Sistema de permissões granular por servidor
- [x] Criptografia AES-256 para senhas

## Testes
- [x] Testes unitários dos routers principais (23 testes passando)
- [x] Checkpoint final

## Deploy / Entrega
- [ ] Push frontend para https://github.com/claytonnetvision/acesso_remoto_front.git
- [ ] Push backend para https://github.com/claytonnetvision/acesso_remoto_back.git

## Arquitetura frp (Túnel Reverso estilo AnyDesk)
- [x] Router frp: generateAgentConfig (token único por servidor)
- [x] Router frp: checkTunnelStatus (via frps dashboard API)
- [x] Router frp: checkAllTunnels (bulk update)
- [x] Router frp: getRdpConnectionInfo (túnel vs direto)
- [x] Geração de frpc.toml personalizado por servidor
- [x] Script install.bat (instala como serviço Windows)
- [x] Script uninstall.bat
- [x] README.txt com instruções de instalação
- [x] Página AgentSetup (download de config, instruções passo a passo)
- [x] Página RdpSession atualizada (tabs Túnel / Direto)
- [x] Dashboard com botão Verificar Túneis
- [x] Botão Agente nos cards de servidor
- [x] Visual AnyDesk (verde primário, sidebar escura, logo RemoteManager)

## Migração PostgreSQL (Neon)
- [ ] Migrar drizzle/schema.ts de MySQL para PostgreSQL
- [ ] Atualizar server/db.ts para usar postgres/neon driver
- [ ] Atualizar drizzle.config.ts para PostgreSQL
- [ ] Atualizar package.json (trocar mysql2 por postgres)
- [ ] Aplicar schema no banco Neon
- [ ] Gerar ZIP atualizado com Neon configurado

## Login Local (sem OAuth)
- [x] Coluna passwordHash na tabela users
- [x] Endpoint POST /api/auth/local-login
- [x] Endpoint POST /api/auth/local-logout
- [x] Tela de login com usuário/senha (/login)
- [x] Usuário admin padrão (admin / admin123) — criado no Neon
- [x] Seed script seed-admin.mjs para criar admin no Neon

## Correções
- [x] Corrigir install.bat — sintaxe do sc create para Windows (usar C:\RemoteAccessAgent sem espaços)

## Deploy Render (frp via WebSocket)
- [x] Dockerfile para frps no Render (frps-render/Dockerfile)
- [x] frps.toml com transport websocket (gerado pelo entrypoint.sh)
- [x] frpc.toml gerado com transport wss (FRP_SERVER_PROTOCOL=wss)
- [x] render.yaml para painel web + frps-render/render.yaml para frps
- [x] Documentação de deploy no Render (frps-render/README.md)

## Migração VPS Hostinger (frps TCP)
- [x] Instalar frps v0.61.1 na VPS Hostinger (31.97.16.12)
- [x] Criar frps.toml com auth token, bindPort 7000, dashboard 7500, allowPorts 20000-29999
- [x] Criar serviço systemd frps (auto-start)
- [x] Configurar firewall ufw (portas 22, 7000, 7500, 20000-29999)
- [x] Configurar variáveis de ambiente FRP_SERVER_ADDR, FRP_SERVER_PORT, FRP_SERVER_PROTOCOL
- [x] Configurar FRP_DASHBOARD_ADDR, FRP_DASHBOARD_PORT, FRP_DASHBOARD_USER, FRP_DASHBOARD_PASS
- [x] Configurar NEON_DATABASE_URL para banco PostgreSQL Neon
- [x] Atualizar db.ts para usar NEON_DATABASE_URL em vez de DATABASE_URL (MySQL)
- [x] Verificar geração de frpc.toml com novo endereço da VPS (31.97.16.12:7000)
- [x] Verificar comunicação painel ↔ frps dashboard (frpsOnline: true)
- [x] Testes unitários: frp.env.test.ts (8 testes) + neon.db.test.ts (4 testes)

## Seleção de SO e compatibilidade de agente

- [x] Adicionar campo osType no schema da tabela servers
- [x] Migrar banco com nova coluna osType (enum: win2008r2, win2012r2, win2016plus, win7, win10, win11, other)
- [x] Atualizar formulário de cadastro/edição de servidor com dropdown de SO
- [x] Atualizar geração do pacote do agente para selecionar frpc correto conforme osType
- [x] Suporte a: Windows 7/10/11, WS2008R2, WS2012R2, WS2016+
- [x] install.bat separado por modo: Modern (frpc.toml, porta 7000) e Legacy (frpc.ini, porta 7001)
- [x] AgentSetup.tsx atualizado com badge de OS, aviso Legacy, downloads corretos por modo
- [x] 43 testes unitários passando (8 novos testes de classificação osType)

## Bugs corrigidos (2026-03-20)

- [x] Rota /agent: agora mostra lista de servidores com contador de túneis ativos/fechados
- [x] Erro ao deletar servidor: deleteServer agora remove registros relacionados (FK cascade manual)
- [x] Contador de túneis ativos/fechados adicionado na página Agente/Túnel

## Monitoramento de Métricas (CPU/RAM/Disco)

- [x] Corrigir rota /settings (404)
- [x] Criar metrics-agent.ps1 (HTTP server PowerShell retornando JSON com CPU/RAM/Disco/Uptime)
- [x] Atualizar frpc.toml gerado para incluir proxy de métricas (porta 9182 → porta remota 21xxx)
- [x] Atualizar install.bat para instalar metrics-agent como segundo serviço Windows
- [x] Criar endpoint tRPC metrics.collect (coleta métricas via túnel FRP)
- [x] Criar página /monitoring com dashboard de CPU/RAM/Disco por servidor
- [x] Alertas visuais quando disco > 85%, CPU > 90%, RAM > 90%

## Melhorias de Monitoramento (2026-03-20)

- [x] Adicionar campo enableMetrics (boolean) na tabela servers
- [x] Toggle de monitoramento no formulário de cadastro/edição de servidor
- [x] Filtrar servidores sem enableMetrics na página de Monitoramento e no frpc.toml
- [x] Exibir nome do cliente acima do hostname nos cards de monitoramento

## Gerenciamento de Usuários Locais (2026-03-20)

- [x] Adicionar campos blocked, passwordHash na tabela users
- [x] Migrar banco Neon com novos campos (blocked, passwordHash)
- [x] Helpers no db.ts: listUsers, createLocalUser, updateUserPasswordHash, toggleUserBlocked, deleteUser, getUserById
- [x] Procedures tRPC: users.list, users.create, users.setPassword, users.toggleBlock, users.delete, users.me
- [x] Página /users: listar, criar, bloquear/desbloquear, excluir, trocar senha (admin)
- [x] Modal de troca de própria senha no dropdown do perfil (sidebar)
- [x] Usuário admin atualizado no Neon com nome, email e senha padrão (admin/admin123)
