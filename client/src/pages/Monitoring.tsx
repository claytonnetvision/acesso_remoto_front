import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Cpu,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
  Clock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

// Thresholds for alerts
const ALERT_CPU = 85;
const ALERT_RAM = 85;
const ALERT_DISK = 90;

function getStatusColor(pct: number, warn = 70, danger = 85) {
  if (pct >= danger) return "text-red-500";
  if (pct >= warn) return "text-yellow-500";
  return "text-green-500";
}

function getProgressColor(pct: number, warn = 70, danger = 85) {
  if (pct >= danger) return "bg-red-500";
  if (pct >= warn) return "bg-yellow-500";
  return "bg-green-500";
}

function MetricBar({
  label,
  value,
  max,
  unit,
  pct,
  icon: Icon,
  warnAt = 70,
  dangerAt = 85,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  pct: number;
  icon: React.ElementType;
  warnAt?: number;
  dangerAt?: number;
}) {
  const color = getStatusColor(pct, warnAt, dangerAt);
  const barColor = getProgressColor(pct, warnAt, dangerAt);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-muted-foreground">{label}</span>
        </div>
        <span className={`font-semibold ${color}`}>
          {pct}% <span className="text-xs text-muted-foreground font-normal">({value}{unit} / {max}{unit})</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

type MetricsResult = {
  serverId: number;
  hostname: string;
  clientName?: string;
  available: boolean;
  metricsPort?: number;
  cpu?: number;
  ram?: { totalMB: number; usedMB: number; freeMB: number; pct: number };
  disks?: Array<{ drive: string; totalGB: number; freeGB: number; usedGB: number; pct: number }>;
  uptime?: string;
  os?: string;
  timestamp?: number;
};

function ServerMetricsCard({ server }: { server: MetricsResult }) {
  const hasAlerts =
    server.available &&
    ((server.cpu ?? 0) >= ALERT_CPU ||
      (server.ram?.pct ?? 0) >= ALERT_RAM ||
      (server.disks ?? []).some((d) => d.pct >= ALERT_DISK));

  return (
    <Card className={`border ${hasAlerts ? "border-yellow-500/50" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              {server.clientName && (
                <p className="text-xs text-muted-foreground font-medium leading-none mb-0.5">{server.clientName}</p>
              )}
              <CardTitle className="text-base leading-none">{server.hostname}</CardTitle>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasAlerts && (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Alerta
              </Badge>
            )}
            {server.available ? (
              <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
                <Wifi className="h-3 w-3 mr-1" />
                Online
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <WifiOff className="h-3 w-3 mr-1" />
                Sem métricas
              </Badge>
            )}
          </div>
        </div>
        {server.available && server.os && (
          <p className="text-xs text-muted-foreground">{server.os}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {server.available ? (
          <>
            {/* CPU */}
            <MetricBar
              label="CPU"
              value={server.cpu ?? 0}
              max={100}
              unit="%"
              pct={server.cpu ?? 0}
              icon={Cpu}
              warnAt={70}
              dangerAt={ALERT_CPU}
            />

            {/* RAM */}
            {server.ram && (
              <MetricBar
                label="RAM"
                value={Math.round(server.ram.usedMB / 1024 * 10) / 10}
                max={Math.round(server.ram.totalMB / 1024 * 10) / 10}
                unit="GB"
                pct={server.ram.pct}
                icon={MemoryStick}
                warnAt={70}
                dangerAt={ALERT_RAM}
              />
            )}

            {/* Disks */}
            {(server.disks ?? []).map((disk) => (
              <MetricBar
                key={disk.drive}
                label={`Disco ${disk.drive}`}
                value={disk.usedGB}
                max={disk.totalGB}
                unit="GB"
                pct={disk.pct}
                icon={HardDrive}
                warnAt={75}
                dangerAt={ALERT_DISK}
              />
            ))}

            {/* Uptime */}
            {server.uptime && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t">
                <Clock className="h-3.5 w-3.5" />
                <span>Uptime: {server.uptime}</span>
              </div>
            )}
          </>
        ) : (
          <div className="py-4 text-center text-sm text-muted-foreground">
            <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Agente de métricas não disponível.</p>
            <p className="text-xs mt-1">
              Reinstale o agente para habilitar o monitoramento.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Monitoring() {
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: metrics, isLoading, refetch, dataUpdatedAt } = trpc.frp.getAllMetrics.useQuery(
    undefined,
    {
      refetchInterval: autoRefresh ? 30000 : false,
      staleTime: 20000,
    }
  );

  const available = (metrics ?? []).filter((m) => m.available);
  const unavailable = (metrics ?? []).filter((m) => !m.available);
  const alerts = (metrics ?? []).filter(
    (m) => {
      const mm = m as MetricsResult;
      return mm.available &&
        ((mm.cpu ?? 0) >= ALERT_CPU ||
          (mm.ram?.pct ?? 0) >= ALERT_RAM ||
          (mm.disks ?? []).some((d: { pct: number }) => d.pct >= ALERT_DISK));
    }
  );

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR") : null;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Monitoramento</h1>
            <p className="text-muted-foreground text-sm mt-1">
              CPU, RAM e disco em tempo real via túnel FRP
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh((v) => !v)}
              className={autoRefresh ? "border-green-500 text-green-500" : ""}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? "Auto (30s)" : "Manual"}
            </Button>
            <Button size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <Server className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{(metrics ?? []).length}</p>
                  <p className="text-xs text-muted-foreground">Total servidores</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-500">{available.length}</p>
                  <p className="text-xs text-muted-foreground">Com métricas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <WifiOff className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{unavailable.length}</p>
                  <p className="text-xs text-muted-foreground">Sem agente</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold text-yellow-500">{alerts.length}</p>
                  <p className="text-xs text-muted-foreground">Com alertas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts banner */}
        {alerts.length > 0 && (
          <Alert className="border-yellow-500/50 bg-yellow-500/5">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-600 dark:text-yellow-400">
              <strong>{alerts.length} servidor(es) com uso elevado:</strong>{" "}
              {alerts.map((a) => a.hostname).join(", ")}. Verifique CPU, RAM ou disco.
            </AlertDescription>
          </Alert>
        )}

        {/* Last update */}
        {lastUpdate && (
          <p className="text-xs text-muted-foreground">
            Última atualização: {lastUpdate}
            {autoRefresh && " · Auto-refresh ativo (30s)"}
          </p>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-48" />
              </Card>
            ))}
          </div>
        )}

        {/* Server cards */}
        {!isLoading && (metrics ?? []).length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Nenhum servidor cadastrado</p>
            <p className="text-sm mt-1">Cadastre servidores e instale o agente para ver as métricas.</p>
          </div>
        )}

        {!isLoading && (metrics ?? []).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(metrics ?? []).map((server) => (
              <ServerMetricsCard key={server.serverId} server={server} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
