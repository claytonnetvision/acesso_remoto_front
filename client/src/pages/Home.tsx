import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  Building2,
  Clock,
  Monitor,
  MonitorCheck,
  TrendingUp,
  Wifi,
  WifiOff,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`relative overflow-hidden border-0 shadow-sm card-hover ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -translate-y-6 translate-x-6 ${color}`} />
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
            <p className="text-4xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1 font-light">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${color} bg-opacity-15`}>
            <Icon className={`h-5 w-5`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    connect: "Conexão RDP",
    disconnect: "Desconexão",
    view_credentials: "Credenciais visualizadas",
    create: "Criação",
    update: "Atualização",
    delete: "Exclusão",
  };
  return map[action] ?? action;
}

function actionColor(action: string) {
  const map: Record<string, string> = {
    connect: "bg-green-100 text-green-700",
    disconnect: "bg-slate-100 text-slate-600",
    view_credentials: "bg-yellow-100 text-yellow-700",
    create: "bg-blue-100 text-blue-700",
    update: "bg-purple-100 text-purple-700",
    delete: "bg-red-100 text-red-700",
  };
  return map[action] ?? "bg-gray-100 text-gray-600";
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const checkAllTunnels = trpc.frp.checkAllTunnels.useMutation({
    onSuccess: (data) => {
      if (data.frpsOnline) {
        toast.success(`Status atualizado: ${data.updated} servidor(es) alterado(s).`);
      } else {
        toast.warning("Servidor frps não está acessível. Configure o frps para monitoramento automático.");
      }
    },
    onError: () => toast.error("Erro ao verificar túneis."),
  });

  const onlineRate = stats
    ? stats.totalServers > 0
      ? Math.round((stats.onlineServers / stats.totalServers) * 100)
      : 0
    : 0;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground font-light mt-1">
              Bem-vindo, <span className="font-medium text-foreground">{user?.name?.split(" ")[0]}</span>. Visão geral do sistema.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => checkAllTunnels.mutate()}
              disabled={checkAllTunnels.isPending}
            >
              {checkAllTunnels.isPending ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Cpu className="h-3.5 w-3.5" />
              )}
              Verificar Túneis
            </Button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-card border rounded-lg px-3 py-2 shadow-sm">
              <Clock className="h-3.5 w-3.5" />
              <span>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-20 mb-3" />
                  <Skeleton className="h-10 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Building2}
              label="Clientes"
              value={stats?.totalClients ?? 0}
              sub="cadastrados"
              color="bg-[oklch(0.82_0.08_230)]"
              onClick={() => setLocation("/clients")}
            />
            <StatCard
              icon={Monitor}
              label="Servidores"
              value={stats?.totalServers ?? 0}
              sub="no sistema"
              color="bg-primary"
              onClick={() => setLocation("/servers")}
            />
            <StatCard
              icon={MonitorCheck}
              label="Online"
              value={stats?.onlineServers ?? 0}
              sub={`${onlineRate}% disponíveis`}
              color="bg-green-500"
              onClick={() => setLocation("/servers")}
            />
            <StatCard
              icon={TrendingUp}
              label="Acessos"
              value={stats?.recentLogs?.length ?? 0}
              sub="últimas atividades"
              color="bg-[oklch(0.88_0.06_350)]"
              onClick={() => setLocation("/logs")}
            />
          </div>
        )}

        {/* Status bar */}
        {!isLoading && stats && stats.totalServers > 0 && (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-semibold">Disponibilidade dos Servidores</span>
                </div>
                <span className="text-sm font-bold text-primary">{onlineRate}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-[oklch(0.72_0.1_230)] rounded-full transition-all duration-700"
                  style={{ width: `${onlineRate}%` }}
                />
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  {stats.onlineServers} online
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  {stats.totalServers - stats.onlineServers} offline/desconhecido
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Atividade Recente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="px-6 pb-6 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-3 w-32 mb-1.5" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : stats?.recentLogs?.length === 0 ? (
                <div className="px-6 pb-6 text-center py-8">
                  <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-light">Nenhuma atividade registrada</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {stats?.recentLogs?.slice(0, 8).map((log) => (
                    <div key={log.id} className="flex items-center gap-3 px-6 py-3 hover:bg-secondary/50 transition-colors">
                      <Badge className={`text-[10px] px-2 py-0.5 font-semibold rounded-md shrink-0 ${actionColor(log.action)}`}>
                        {actionLabel(log.action)}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{log.details ?? log.resourceType}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground/70 shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Acesso Rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Ver todos os servidores", sub: "Gerenciar e conectar", path: "/servers", icon: Monitor, color: "bg-[oklch(0.82_0.08_230/0.15)] text-primary" },
                { label: "Gerenciar clientes", sub: "Cadastros e informações", path: "/clients", icon: Building2, color: "bg-[oklch(0.88_0.06_350/0.2)] text-[oklch(0.45_0.1_350)]" },
                { label: "Logs de auditoria", sub: "Histórico de acessos", path: "/logs", icon: Activity, color: "bg-green-100 text-green-700" },
                { label: "Credenciais", sub: "Senhas e acessos", path: "/credentials", icon: WifiOff, color: "bg-purple-100 text-purple-700" },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-secondary transition-all text-left group"
                >
                  <div className={`p-2.5 rounded-xl ${item.color}`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">{item.label}</p>
                    <p className="text-xs text-muted-foreground font-light">{item.sub}</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
