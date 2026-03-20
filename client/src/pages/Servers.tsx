import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Edit2,
  Monitor,
  MonitorOff,
  Plus,
  Search,
  Trash2,
  Wifi,
  WifiOff,
  Wrench,
  Zap,
  Cpu,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";

type ServerStatus = "online" | "offline" | "unknown" | "maintenance";

const statusConfig: Record<ServerStatus, { label: string; icon: React.ElementType; cls: string }> = {
  online: { label: "Online", icon: Wifi, cls: "bg-green-100 text-green-700 border-green-200" },
  offline: { label: "Offline", icon: WifiOff, cls: "bg-red-100 text-red-700 border-red-200" },
  unknown: { label: "Desconhecido", icon: Monitor, cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  maintenance: { label: "Manutenção", icon: Wrench, cls: "bg-orange-100 text-orange-700 border-orange-200" },
};

const OS_OPTIONS = [
  { value: "win2016plus", label: "Windows Server 2016 / 2019 / 2022" },
  { value: "win2012r2", label: "Windows Server 2012 R2" },
  { value: "win2008r2", label: "Windows Server 2008 R2" },
  { value: "win11", label: "Windows 11" },
  { value: "win10", label: "Windows 10" },
  { value: "win7", label: "Windows 7" },
  { value: "other", label: "Outro" },
] as const;

type OsType = typeof OS_OPTIONS[number]["value"];

type FormData = {
  clientId: string;
  hostname: string;
  ipAddress: string;
  rdpPort: string;
  osType: OsType;
  description: string;
  notes: string;
  enableMetrics: boolean;
};

const emptyForm: FormData = {
  clientId: "",
  hostname: "",
  ipAddress: "",
  rdpPort: "3389",
  osType: "win2016plus",
  description: "",
  notes: "",
  enableMetrics: true,
};

export default function Servers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const clientIdParam = params.get("clientId");

  const [search, setSearch] = useState("");
  const [filterClientId, setFilterClientId] = useState<number | undefined>(
    clientIdParam ? parseInt(clientIdParam) : undefined
  );
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const isAdmin = user?.role === "admin";

  const utils = trpc.useUtils();
  const { data: clients } = trpc.clients.list.useQuery({});
  const { data: servers, isLoading } = trpc.servers.list.useQuery({
    clientId: filterClientId,
    search: search || undefined,
  });

  const createMutation = trpc.servers.create.useMutation({
    onSuccess: () => { utils.servers.list.invalidate(); toast.success("Servidor criado!"); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.servers.update.useMutation({
    onSuccess: () => { utils.servers.list.invalidate(); toast.success("Servidor atualizado!"); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.servers.delete.useMutation({
    onSuccess: () => { utils.servers.list.invalidate(); toast.success("Servidor removido!"); },
    onError: (e) => toast.error(e.message),
  });
  const updateStatusMutation = trpc.servers.updateStatus.useMutation({
    onSuccess: () => utils.servers.list.invalidate(),
  });

  function openCreate() {
    setEditId(null);
    setForm({ ...emptyForm, clientId: filterClientId?.toString() ?? "" });
    setOpen(true);
  }

  function openEdit(s: NonNullable<typeof servers>[0]) {
    setEditId(s.id);
    setForm({
      clientId: s.clientId.toString(),
      hostname: s.hostname,
      ipAddress: s.ipAddress,
      rdpPort: s.rdpPort.toString(),
      osType: (s.osType as OsType) ?? "win2016plus",
      description: s.description ?? "",
      notes: s.notes ?? "",
      enableMetrics: s.enableMetrics ?? true,
    });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      clientId: parseInt(form.clientId),
      hostname: form.hostname,
      ipAddress: form.ipAddress,
      rdpPort: parseInt(form.rdpPort) || 3389,
      osType: form.osType,
      operatingSystem: OS_OPTIONS.find(o => o.value === form.osType)?.label,
      description: form.description || undefined,
      notes: form.notes || undefined,
      enableMetrics: form.enableMetrics,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  const clientName = (id: number) => clients?.find((c) => c.id === id)?.name ?? "-";

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Servidores</h1>
            <p className="text-muted-foreground font-light mt-1">
              {servers?.length ?? 0} servidor{servers?.length !== 1 ? "es" : ""} cadastrado{servers?.length !== 1 ? "s" : ""}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Novo Servidor
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por hostname, IP..."
              className="pl-9 bg-card border-border/60 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={filterClientId?.toString() ?? "all"}
            onValueChange={(v) => setFilterClientId(v === "all" ? undefined : parseInt(v))}
          >
            <SelectTrigger className="w-52 bg-card border-border/60 shadow-sm">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients?.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="grid gap-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : servers?.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <MonitorOff className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="font-semibold text-muted-foreground">Nenhum servidor encontrado</p>
              <p className="text-sm text-muted-foreground font-light mt-1">
                {search ? "Tente outro termo" : "Adicione um servidor para começar"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {servers?.map((s) => {
              const status = statusConfig[s.status as ServerStatus] ?? statusConfig.unknown;
              const StatusIcon = status.icon;
              return (
                <Card key={s.id} className="border-0 shadow-sm card-hover group">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.status === "online" ? "bg-green-100" : s.status === "offline" ? "bg-red-100" : "bg-yellow-100"}`}>
                          <StatusIcon className={`h-5 w-5 ${s.status === "online" ? "text-green-600" : s.status === "offline" ? "text-red-600" : "text-yellow-600"}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base">{s.hostname}</h3>
                            <Badge className={`text-[10px] px-2 py-0.5 border ${status.cls}`}>
                              {status.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">{s.ipAddress}:{s.rdpPort}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">{clientName(s.clientId)}</span>
                            {s.operatingSystem && (
                              <>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">{s.operatingSystem}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => setLocation(`/agent/${s.id}`)}
                        >
                          <Cpu className="h-3.5 w-3.5" />
                          Agente
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 text-xs shadow-sm"
                          onClick={() => setLocation(`/rdp/${s.id}`)}
                        >
                          <Zap className="h-3.5 w-3.5" />
                          Conectar
                        </Button>
                        {isAdmin && (
                          <>
                            <Select
                              value={s.status}
                              onValueChange={(v) => updateStatusMutation.mutate({ id: s.id, status: v as ServerStatus })}
                            >
                              <SelectTrigger className="h-8 w-32 text-xs border-border/60">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="online">Online</SelectItem>
                                <SelectItem value="offline">Offline</SelectItem>
                                <SelectItem value="unknown">Desconhecido</SelectItem>
                                <SelectItem value="maintenance">Manutenção</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(s)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`Remover servidor "${s.hostname}"?`)) deleteMutation.mutate({ id: s.id });
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editId ? "Editar Servidor" : "Novo Servidor"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Cliente *</Label>
                <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Hostname *</Label>
                <Input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} required placeholder="SRV-CLIENTE-01" />
              </div>
              <div className="space-y-1.5">
                <Label>Endereço IP *</Label>
                <Input value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} required placeholder="192.168.1.100" />
              </div>
              <div className="space-y-1.5">
                <Label>Porta RDP</Label>
                <Input type="number" value={form.rdpPort} onChange={(e) => setForm({ ...form, rdpPort: e.target.value })} placeholder="3389" />
              </div>
              <div className="space-y-1.5">
                <Label>Sistema Operacional *</Label>
                <Select value={form.osType} onValueChange={(v) => setForm({ ...form, osType: v as OsType })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o SO" /></SelectTrigger>
                  <SelectContent>
                    {OS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Descrição</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Servidor de arquivos, ERP, etc." />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Informações adicionais..." rows={3} />
              </div>
              <div className="col-span-2">
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1">
                    <p className="text-sm font-medium">Monitoramento de métricas</p>
                    <p className="text-xs text-muted-foreground">Coleta CPU, RAM e disco via túnal FRP. Desative se não quiser instalar o agente de métricas neste servidor.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.enableMetrics}
                    onClick={() => setForm({ ...form, enableMetrics: !form.enableMetrics })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                      form.enableMetrics ? 'bg-green-500' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      form.enableMetrics ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editId ? "Salvar alterações" : "Criar servidor"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
