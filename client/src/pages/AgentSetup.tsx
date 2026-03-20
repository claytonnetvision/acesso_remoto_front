/**
 * AgentSetup Page
 *
 * Shows per-server agent download and installation instructions.
 * Automatically selects legacy (WS2008 R2/2012 R2/Win7) or modern mode
 * based on the server's osType field.
 */
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Download,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Copy,
  Server,
  Wifi,
  WifiOff,
  RefreshCw,
  ArrowLeft,
  Package,
  Shield,
  Settings2,
  Monitor,
} from "lucide-react";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 gap-1 text-xs">
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {label ?? (copied ? "Copiado!" : "Copiar")}
    </Button>
  );
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="relative rounded-lg bg-[oklch(0.13_0.01_240)] border border-[oklch(0.25_0.01_240)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[oklch(0.25_0.01_240)]">
        <span className="text-xs text-[oklch(0.55_0.01_240)] font-mono">{language}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 text-sm text-[oklch(0.88_0.005_240)] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

type AgentConfig = {
  frpcToml: string;
  frpcIni: string;
  installBat: string;
  uninstallBat: string;
  readme: string;
  rdpRemotePort: number;
  serverAddr: string;
  serverPort: number;
  isLegacy: boolean;
  osType: string;
  frpcDownloadUrl: string;
};

const OS_LABELS: Record<string, string> = {
  win2008r2: "Windows Server 2008 R2",
  win2012r2: "Windows Server 2012 R2",
  win2016plus: "Windows Server 2016/2019/2022",
  win7: "Windows 7",
  win10: "Windows 10",
  win11: "Windows 11",
  other: "Outro",
};

export default function AgentSetup() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const serverId = parseInt(params.id ?? "0");

  const { data: server, isLoading: serverLoading } = trpc.servers.get.useQuery(
    { id: serverId },
    { enabled: !!serverId }
  );

  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);

  const generateConfig = trpc.frp.generateAgentConfig.useMutation({
    onSuccess: (data) => {
      setAgentConfig(data as AgentConfig);
      toast.success(
        `Configuração gerada: modo ${(data as AgentConfig).isLegacy ? "Legacy (WS2008 R2/2012 R2)" : "Modern (WS2016+)"}`
      );
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: tunnelStatus, refetch: refetchStatus } = trpc.frp.checkTunnelStatus.useQuery(
    { serverId },
    { enabled: !!serverId, refetchInterval: 30_000 }
  );

  const handleDownloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    if (!agentConfig) return;
    if (agentConfig.isLegacy) {
      // Legacy: frpc.ini + install.bat + uninstall.bat + README
      handleDownloadFile(agentConfig.frpcIni, "frpc.ini");
      setTimeout(() => handleDownloadFile(agentConfig.installBat, "install.bat"), 200);
      setTimeout(() => handleDownloadFile(agentConfig.uninstallBat, "uninstall.bat"), 400);
      setTimeout(() => handleDownloadFile(agentConfig.readme, "README.txt"), 600);
      toast.info("Baixando 4 arquivos (frpc.ini + scripts)... O frpc-legacy.exe será baixado pelo install.bat.");
    } else {
      // Modern: frpc.toml + install.bat + uninstall.bat + README
      handleDownloadFile(agentConfig.frpcToml, "frpc.toml");
      setTimeout(() => handleDownloadFile(agentConfig.installBat, "install.bat"), 200);
      setTimeout(() => handleDownloadFile(agentConfig.uninstallBat, "uninstall.bat"), 400);
      setTimeout(() => handleDownloadFile(agentConfig.readme, "README.txt"), 600);
      toast.info("Baixando 4 arquivos (frpc.toml + scripts)... Coloque frpc.exe na mesma pasta.");
    }
  };

  if (serverLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!server) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <p className="text-muted-foreground">Servidor não encontrado.</p>
          <Button variant="outline" onClick={() => navigate("/servers")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isOnline = tunnelStatus?.online ?? server.status === "online";
  const serverOsType = (server as { osType?: string }).osType ?? "win2016plus";
  const serverIsLegacy = ["win2008r2", "win2012r2", "win7"].includes(serverOsType);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/servers")} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{server.hostname}</h1>
              <Badge
                className={isOnline ? "status-online" : "status-offline"}
                variant="outline"
              >
                <span className={isOnline ? "pulse-online mr-1.5" : "pulse-offline mr-1.5"} />
                {isOnline ? "Online" : "Offline"}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Monitor className="w-3 h-3" />
                {OS_LABELS[serverOsType] ?? serverOsType}
              </Badge>
              {serverIsLegacy && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                  Legacy Mode
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configuração do Agente de Acesso Remoto
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchStatus()}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Verificar Status
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={`border-2 ${isOnline ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}`}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                {isOnline ? (
                  <Wifi className="w-8 h-8 text-green-600" />
                ) : (
                  <WifiOff className="w-8 h-8 text-red-500" />
                )}
                <div>
                  <p className="font-semibold text-sm">Status do Túnel</p>
                  <p className={`text-lg font-bold ${isOnline ? "text-green-600" : "text-red-500"}`}>
                    {isOnline ? "Conectado" : "Desconectado"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <Server className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-semibold text-sm">Porta RDP Remota</p>
                  <p className="text-lg font-bold font-mono text-primary">
                    {tunnelStatus?.rdpRemotePort ?? agentConfig?.rdpRemotePort ?? "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="font-semibold text-sm">Endereço Direto</p>
                  <p className="text-sm font-mono text-muted-foreground">
                    {server.ipAddress}:{server.rdpPort}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Legacy OS Warning */}
        {serverIsLegacy && (
          <div className="rounded-lg bg-amber-50 border border-amber-300 p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">⚠️ Modo Legacy Ativo ({OS_LABELS[serverOsType]})</p>
            <p>
              Este servidor usa <strong>frpc v0.51.3</strong> (porta 7001) com configuração no formato INI.
              O frpc-legacy.exe será baixado automaticamente pelo <code className="font-mono bg-amber-100 px-1 rounded">install.bat</code>.
              Não é necessário baixar o frpc.exe manualmente.
            </p>
          </div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="setup" className="space-y-4">
          <TabsList>
            <TabsTrigger value="setup" className="gap-2">
              <Package className="w-4 h-4" /> Instalar Agente
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2" disabled={!agentConfig}>
              <Settings2 className="w-4 h-4" /> Configuração
            </TabsTrigger>
            <TabsTrigger value="connect" className="gap-2">
              <Terminal className="w-4 h-4" /> Como Conectar
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Setup ── */}
          <TabsContent value="setup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Pacote de Instalação do Agente
                  {serverIsLegacy && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 ml-2">
                      Legacy
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {serverIsLegacy
                    ? "Modo Legacy: frpc v0.51.3 com INI config (WS2008 R2 / WS2012 R2 / Win7). O frpc-legacy.exe é baixado automaticamente."
                    : "Modo Modern: frpc v0.61.1 com TOML config (WS2016+, Win10/11). Coloque frpc.exe na mesma pasta do install.bat."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Step 1 — only for modern OS */}
                {!serverIsLegacy && (
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <div className="flex-1 space-y-3">
                      <h3 className="font-semibold">Baixar o frpc.exe</h3>
                      <p className="text-sm text-muted-foreground">
                        Baixe o cliente frp para Windows (frpc.exe) do servidor VPS:
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => window.open("http://31.97.16.12/frpc.exe", "_blank")}
                        >
                          <Download className="w-4 h-4" />
                          frpc.exe (v0.61.1)
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-muted-foreground"
                          onClick={() => window.open(
                            "https://github.com/fatedier/frp/releases/latest",
                            "_blank"
                          )}
                        >
                          <Download className="w-4 h-4" />
                          GitHub Releases
                        </Button>
                      </div>
                      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                        <strong>Arquivo necessário:</strong> Apenas o <code className="font-mono bg-blue-100 px-1 rounded">frpc.exe</code> — coloque na mesma pasta do <code className="font-mono bg-blue-100 px-1 rounded">install.bat</code>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 1 for legacy — info only */}
                {serverIsLegacy && (
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <div className="flex-1 space-y-3">
                      <h3 className="font-semibold">frpc-legacy.exe (automático)</h3>
                      <p className="text-sm text-muted-foreground">
                        Para WS2008 R2 / WS2012 R2, o <strong>install.bat baixa automaticamente</strong> o frpc-legacy.exe (v0.51.3) do servidor VPS.
                        Não é necessário baixar manualmente.
                      </p>
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                        <strong>Porta usada:</strong> 7001 (frps-legacy v0.51.3) — compatível com WS2008 R2 e WS2012 R2
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2 — Generate config */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="font-semibold">Gerar Configuração</h3>
                    <p className="text-sm text-muted-foreground">
                      Gere o arquivo de configuração personalizado para este servidor:
                    </p>
                    <Button
                      onClick={() => generateConfig.mutate({ serverId })}
                      disabled={generateConfig.isPending}
                      className="gap-2 bg-primary text-primary-foreground hover:opacity-90"
                    >
                      {generateConfig.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Settings2 className="w-4 h-4" />
                      )}
                      {agentConfig ? "Regenerar Configuração" : "Gerar Configuração"}
                    </Button>
                  </div>
                </div>

                {/* Step 3 — Download files */}
                {agentConfig && (
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <div className="flex-1 space-y-3">
                      <h3 className="font-semibold">Baixar Arquivos de Instalação</h3>
                      <p className="text-sm text-muted-foreground">
                        {agentConfig.isLegacy
                          ? "Baixe os arquivos para o modo Legacy (frpc.ini + scripts):"
                          : "Baixe os arquivos para o modo Modern (frpc.toml + scripts):"}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {agentConfig.isLegacy ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleDownloadFile(agentConfig.frpcIni, "frpc.ini")}
                          >
                            <Download className="w-4 h-4" /> frpc.ini
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleDownloadFile(agentConfig.frpcToml, "frpc.toml")}
                          >
                            <Download className="w-4 h-4" /> frpc.toml
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleDownloadFile(agentConfig.installBat, "install.bat")}
                        >
                          <Download className="w-4 h-4" /> install.bat
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleDownloadFile(agentConfig.uninstallBat, "uninstall.bat")}
                        >
                          <Download className="w-4 h-4" /> uninstall.bat
                        </Button>
                        <Button
                          size="sm"
                          className="gap-2 bg-primary text-primary-foreground hover:opacity-90"
                          onClick={handleDownloadAll}
                        >
                          <Download className="w-4 h-4" /> Baixar Todos
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4 — Install */}
                {agentConfig && (
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      4
                    </div>
                    <div className="flex-1 space-y-3">
                      <h3 className="font-semibold">Instalar no Windows Server</h3>
                      <p className="text-sm text-muted-foreground">
                        No servidor Windows, coloque os arquivos na mesma pasta e execute:
                      </p>
                      <ol className="text-sm space-y-2 list-none">
                        {(agentConfig.isLegacy ? [
                          "Copie frpc.ini e install.bat para uma pasta (ex: C:\\Temp\\agent\\)",
                          "Clique com botão direito em install.bat",
                          "Selecione \"Executar como administrador\"",
                          "O script baixa automaticamente frpc-legacy.exe e WinSW",
                          "Aguarde: Agent installed and running successfully!",
                        ] : [
                          "Copie frpc.exe, frpc.toml e install.bat para uma pasta (ex: C:\\Temp\\agent\\)",
                          "Clique com botão direito em install.bat",
                          "Selecione \"Executar como administrador\"",
                          "Aguarde: Agent installed and running successfully!",
                        ]).map((step, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                      <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                        <strong>Resultado:</strong> O servidor aparecerá como{" "}
                        <span className="font-semibold text-green-700">Online</span> neste painel
                        em até 30 segundos.
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab: Config ── */}
          {agentConfig && (
            <TabsContent value="config" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {agentConfig.isLegacy ? "frpc.ini (Legacy)" : "frpc.toml (Modern)"}
                  </CardTitle>
                  <CardDescription>
                    {agentConfig.isLegacy
                      ? `Configuração INI para frpc v0.51.3 — porta 7001 (${OS_LABELS[agentConfig.osType] ?? agentConfig.osType})`
                      : `Configuração TOML para frpc v0.61.1 — porta ${agentConfig.serverPort} (${OS_LABELS[agentConfig.osType] ?? agentConfig.osType})`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock
                    code={agentConfig.isLegacy ? agentConfig.frpcIni : agentConfig.frpcToml}
                    language={agentConfig.isLegacy ? "ini" : "toml"}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>install.bat</CardTitle>
                  <CardDescription>
                    Script de instalação como serviço Windows
                    {agentConfig.isLegacy ? " (modo Legacy)" : " (modo Modern)"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={agentConfig.installBat} language="batch" />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ── Tab: Connect ── */}
          <TabsContent value="connect" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" />
                  Como Conectar via Túnel
                </CardTitle>
                <CardDescription>
                  Com o agente instalado e online, use qualquer cliente RDP para conectar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-2">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                      Via Túnel (Recomendado)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Funciona de qualquer lugar, sem abrir portas no firewall
                    </p>
                    <div className="font-mono text-sm bg-background rounded p-2 border">
                      <span className="text-muted-foreground">Host: </span>
                      <span className="font-bold">
                        {agentConfig?.serverAddr ?? "seu-servidor.com"}
                      </span>
                      <br />
                      <span className="text-muted-foreground">Porta: </span>
                      <span className="font-bold text-primary">
                        {tunnelStatus?.rdpRemotePort ?? agentConfig?.rdpRemotePort ?? "—"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Direto (Rede Local / VPN)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Apenas quando na mesma rede ou com VPN ativa
                    </p>
                    <div className="font-mono text-sm bg-background rounded p-2 border">
                      <span className="text-muted-foreground">Host: </span>
                      <span className="font-bold">{server.ipAddress}</span>
                      <br />
                      <span className="text-muted-foreground">Porta: </span>
                      <span className="font-bold">{server.rdpPort}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Usando mstsc.exe (Windows)</h4>
                  <CodeBlock
                    code={`mstsc /v:${agentConfig?.serverAddr ?? "seu-servidor.com"}:${tunnelStatus?.rdpRemotePort ?? agentConfig?.rdpRemotePort ?? "20001"}`}
                    language="cmd"
                  />
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Usando rdesktop (Linux/Mac)</h4>
                  <CodeBlock
                    code={`rdesktop ${agentConfig?.serverAddr ?? "seu-servidor.com"}:${tunnelStatus?.rdpRemotePort ?? agentConfig?.rdpRemotePort ?? "20001"} -u Administrator`}
                    language="bash"
                  />
                </div>

                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 space-y-1">
                  <p className="font-semibold">Dica de Segurança</p>
                  <p>
                    {serverIsLegacy
                      ? "Modo Legacy: token compartilhado via frps-legacy v0.51.3 na porta 7001. Compatível com WS2008 R2 e WS2012 R2."
                      : "Modo Modern: token único por servidor via frps v0.61.1 na porta 7000. Cada servidor tem sua própria porta remota dedicada no intervalo 20000–29999."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
