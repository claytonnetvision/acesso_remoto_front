/**
 * RdpSession Page
 *
 * Provides RDP connection info for a server, supporting both:
 * - Tunnel mode (via frp reverse proxy — works from anywhere)
 * - Direct mode (via IP:port — requires NAT or VPN)
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Monitor,
  RefreshCw,
  Terminal,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";

export default function RdpSession() {
  const { id } = useParams<{ id: string }>();
  const serverId = parseInt(id ?? "0");
  const [, setLocation] = useLocation();

  const [sessionData, setSessionData] = useState<{
    hostname: string;
    ipAddress: string;
    rdpPort: number;
    username: string;
    password: string;
    domain: string;
    sessionToken: string;
  } | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const utils = trpc.useUtils();
  const { data: server, isLoading: serverLoading } = trpc.servers.get.useQuery(
    { id: serverId },
    { enabled: !!serverId }
  );

  // Tunnel connection info
  const { data: tunnelInfo, refetch: refetchTunnel } = trpc.frp.getRdpConnectionInfo.useQuery(
    { serverId },
    { enabled: !!serverId }
  );

  // Tunnel status
  const { data: tunnelStatus, refetch: refetchStatus } = trpc.frp.checkTunnelStatus.useQuery(
    { serverId },
    { enabled: !!serverId, refetchInterval: 30_000 }
  );

  const startMutation = trpc.rdp.startSession.useMutation({
    onSuccess: (data) => {
      setSessionData(data);
      setSessionStarted(true);
      setSessionStart(new Date());
      toast.success("Sessão iniciada! Use as credenciais abaixo para conectar.");
    },
    onError: (e) => toast.error(e.message),
  });

  const endMutation = trpc.rdp.endSession.useMutation({
    onSuccess: () => {
      utils.logs.list.invalidate();
      toast.success("Sessão encerrada.");
    },
  });

  useEffect(() => {
    if (sessionStarted) {
      timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionStarted]);

  function formatElapsed(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function handleEndSession() {
    if (timerRef.current) clearInterval(timerRef.current);
    endMutation.mutate({ serverId, duration: elapsed });
    setSessionStarted(false);
    setSessionData(null);
    setElapsed(0);
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado!");
    setTimeout(() => setCopied(null), 2000);
  }

  function openRdpFile(useTunnel: boolean) {
    const host = useTunnel
      ? tunnelInfo?.tunnelHost ?? server?.ipAddress ?? ""
      : server?.ipAddress ?? "";
    const port = useTunnel
      ? tunnelInfo?.tunnelPort ?? server?.rdpPort ?? 3389
      : server?.rdpPort ?? 3389;
    const username = sessionData?.username ?? "";
    const domain = sessionData?.domain ?? "";

    const rdpContent = [
      `full address:s:${host}:${port}`,
      `username:s:${domain ? domain + "\\" : ""}${username}`,
      `prompt for credentials:i:0`,
      `authentication level:i:2`,
      `compression:i:1`,
      `displayconnectionbar:i:1`,
      `screen mode id:i:2`,
      `use multimon:i:0`,
      `session bpp:i:32`,
      `connection type:i:7`,
      `networkautodetect:i:1`,
      `bandwidthautodetect:i:1`,
      `autoreconnection enabled:i:1`,
      `allow font smoothing:i:1`,
      `allow desktop composition:i:1`,
      `redirectclipboard:i:1`,
      `redirectprinters:i:1`,
    ].join("\n");

    const blob = new Blob([rdpContent], { type: "application/x-rdp" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${server?.hostname ?? "server"}-${useTunnel ? "tunnel" : "direct"}.rdp`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo .rdp baixado! Abra-o com o cliente RDP.");
  }

  if (serverLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            <Monitor className="h-10 w-10 text-muted-foreground/30 mx-auto animate-pulse" />
            <p className="text-muted-foreground font-light">Carregando servidor...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!server) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-destructive/50 mx-auto" />
            <p className="font-semibold">Servidor não encontrado</p>
            <Button variant="outline" size="sm" onClick={() => setLocation("/servers")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const statusColors: Record<string, string> = {
    online: "bg-green-100 text-green-700 border-green-200",
    offline: "bg-red-100 text-red-700 border-red-200",
    unknown: "bg-yellow-100 text-yellow-700 border-yellow-200",
    maintenance: "bg-orange-100 text-orange-700 border-orange-200",
  };

  const isTunnelOnline = tunnelStatus?.online ?? false;
  const tunnelHost = tunnelInfo?.tunnelHost ?? "—";
  const tunnelPort = tunnelStatus?.rdpRemotePort ?? tunnelInfo?.tunnelPort ?? 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setLocation("/servers")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{server.hostname}</h1>
              <Badge className={`text-[10px] px-2 py-0.5 border ${statusColors[server.status] ?? statusColors.unknown}`}>
                {server.status === "online" ? "Online" : server.status === "offline" ? "Offline" : server.status === "maintenance" ? "Manutenção" : "Desconhecido"}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] px-2 py-0.5 gap-1 ${isTunnelOnline ? "border-green-300 text-green-700 bg-green-50" : "border-orange-300 text-orange-700 bg-orange-50"}`}
              >
                {isTunnelOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                Túnel {isTunnelOnline ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <p className="text-muted-foreground font-light text-sm mt-0.5">
              {server.ipAddress}:{server.rdpPort} • {server.operatingSystem ?? "Windows Server"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {sessionStarted && (
              <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-2 rounded-xl border border-green-200">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-semibold">{formatElapsed(elapsed)}</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => { refetchTunnel(); refetchStatus(); }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
          </div>
        </div>

        {/* Tunnel Status Banner */}
        {!isTunnelOnline && (
          <Card className="border-orange-200 bg-orange-50/60">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <WifiOff className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-orange-800 text-sm">Agente não conectado</p>
                  <p className="text-sm text-orange-700 font-light mt-0.5">
                    O agente frpc não está ativo neste servidor. Instale o agente para conectar de qualquer lugar sem NAT.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-100 shrink-0"
                  onClick={() => setLocation(`/agent/${server.id}`)}
                >
                  <Cpu className="h-3.5 w-3.5" /> Instalar Agente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Session start */}
        {!sessionStarted ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 text-center space-y-4">
              <WifiOff className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <div>
                <p className="font-semibold">Nenhuma sessão ativa</p>
                <p className="text-sm text-muted-foreground font-light mt-1">
                  Inicie uma sessão para obter as credenciais de acesso
                </p>
              </div>
              <Button
                className="gap-2 shadow-sm"
                onClick={() => startMutation.mutate({ serverId })}
                disabled={startMutation.isPending}
              >
                {startMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Wifi className="h-4 w-4" />
                )}
                Iniciar Sessão
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Active session header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">Sessão ativa — {formatElapsed(elapsed)}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={handleEndSession}
                disabled={endMutation.isPending}
              >
                <X className="h-3.5 w-3.5" /> Encerrar Sessão
              </Button>
            </div>

            <Tabs defaultValue={isTunnelOnline ? "tunnel" : "direct"}>
              <TabsList className="w-full">
                <TabsTrigger value="tunnel" className="flex-1 gap-2">
                  <Wifi className="h-4 w-4" />
                  Via Túnel
                  {isTunnelOnline && <span className="w-2 h-2 rounded-full bg-green-500 ml-1" />}
                </TabsTrigger>
                <TabsTrigger value="direct" className="flex-1 gap-2">
                  <Terminal className="h-4 w-4" />
                  Conexão Direta
                </TabsTrigger>
              </TabsList>

              {/* ── Tunnel Tab ── */}
              <TabsContent value="tunnel" className="space-y-4 mt-4">
                <Card className={`border-0 shadow-sm ${isTunnelOnline ? "ring-1 ring-green-200" : ""}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-primary" />
                      Conexão via Túnel Reverso
                      {isTunnelOnline ? (
                        <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 ml-auto">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] bg-orange-100 text-orange-700 border-orange-200 ml-auto">
                          Agente offline
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: "Host do Túnel", value: tunnelHost, key: "thost" },
                      { label: "Porta Remota RDP", value: tunnelPort.toString(), key: "tport" },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                        <div>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="font-mono font-semibold text-sm">{item.value}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyText(item.value, item.key)}>
                          <Copy className={`h-3.5 w-3.5 ${copied === item.key ? "text-green-600" : "text-muted-foreground"}`} />
                        </Button>
                      </div>
                    ))}

                    {sessionData && (
                      <>
                        {[
                          { label: "Usuário", value: sessionData.domain ? `${sessionData.domain}\\${sessionData.username}` : sessionData.username, key: "user" },
                          { label: "Senha", value: sessionData.password, key: "pass" },
                        ].map((item) => (
                          <div key={item.key} className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                            <div>
                              <p className="text-xs text-muted-foreground">{item.label}</p>
                              <p className="font-mono font-semibold text-sm">
                                {item.key === "pass" ? "••••••••" : item.value}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyText(item.value, item.key)}>
                              <Copy className={`h-3.5 w-3.5 ${copied === item.key ? "text-green-600" : "text-muted-foreground"}`} />
                            </Button>
                          </div>
                        ))}
                      </>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => openRdpFile(true)}
                        disabled={!isTunnelOnline}
                      >
                        <Download className="h-4 w-4" /> Baixar .rdp (Túnel)
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyText(`${tunnelHost}:${tunnelPort}`, "full-tunnel")}
                        title="Copiar endereço completo"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3">
                      <strong>Comando mstsc:</strong>
                      <code className="block font-mono mt-1 text-foreground">
                        mstsc /v:{tunnelHost}:{tunnelPort}
                      </code>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Direct Tab ── */}
              <TabsContent value="direct" className="space-y-4 mt-4">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-primary" />
                      Conexão Direta (IP/NAT)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                      Requer que a porta {server.rdpPort} esteja aberta no firewall do cliente (NAT/Port Forward) ou que você esteja na mesma rede.
                    </div>

                    {[
                      { label: "Endereço IP", value: server.ipAddress, key: "ip" },
                      { label: "Porta RDP", value: server.rdpPort.toString(), key: "port" },
                      ...(sessionData ? [
                        { label: "Usuário", value: sessionData.domain ? `${sessionData.domain}\\${sessionData.username}` : sessionData.username, key: "duser" },
                        { label: "Senha", value: sessionData.password, key: "dpass" },
                      ] : []),
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                        <div>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="font-mono font-semibold text-sm">
                            {item.key === "dpass" ? "••••••••" : item.value}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyText(item.value, item.key)}>
                          <Copy className={`h-3.5 w-3.5 ${copied === item.key ? "text-green-600" : "text-muted-foreground"}`} />
                        </Button>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => openRdpFile(false)}
                    >
                      <Download className="h-4 w-4" /> Baixar .rdp (Direto)
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
