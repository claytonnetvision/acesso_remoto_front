import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Plus, Shield, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function Permissions() {
  const [open, setOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState("all");
  const [form, setForm] = useState({
    userId: "",
    serverId: "",
    canConnect: true,
    canViewCredentials: false,
  });

  const utils = trpc.useUtils();
  const { data: servers } = trpc.servers.list.useQuery({});
  const { data: users } = trpc.users.list.useQuery();
  const { data: perms, isLoading } = trpc.permissions.listByServer.useQuery(
    { serverId: parseInt(selectedServer) },
    { enabled: selectedServer !== "all" }
  );

  const grantMutation = trpc.permissions.grant.useMutation({
    onSuccess: () => {
      if (selectedServer !== "all") utils.permissions.listByServer.invalidate({ serverId: parseInt(selectedServer) });
      toast.success("Permissão concedida!");
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeMutation = trpc.permissions.revoke.useMutation({
    onSuccess: () => {
      if (selectedServer !== "all") utils.permissions.listByServer.invalidate({ serverId: parseInt(selectedServer) });
      toast.success("Permissão revogada!");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    grantMutation.mutate({
      userId: parseInt(form.userId),
      serverId: parseInt(form.serverId),
      canConnect: form.canConnect,
      canViewCredentials: form.canViewCredentials,
    });
  }

  const userName = (id: number) => users?.find((u) => u.id === id)?.name ?? `Usuário #${id}`;
  const serverName = (id: number) => servers?.find((s) => s.id === id)?.hostname ?? `Servidor #${id}`;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Permissões</h1>
            <p className="text-muted-foreground font-light mt-1">Controle de acesso por usuário e servidor</p>
          </div>
          <Button onClick={() => { setForm({ userId: "", serverId: selectedServer !== "all" ? selectedServer : "", canConnect: true, canViewCredentials: false }); setOpen(true); }} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Conceder Acesso
          </Button>
        </div>

        {/* Server filter */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Filtrar por servidor</Label>
                <Select value={selectedServer} onValueChange={setSelectedServer}>
                  <SelectTrigger className="border-border/60">
                    <SelectValue placeholder="Selecione um servidor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">-- Selecione um servidor --</SelectItem>
                    {servers?.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.hostname}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedServer === "all" ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="font-semibold text-muted-foreground">Selecione um servidor</p>
              <p className="text-sm text-muted-foreground font-light mt-1">Escolha um servidor para ver as permissões</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="grid gap-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-5"><Skeleton className="h-5 w-48 mb-2" /><Skeleton className="h-4 w-32" /></CardContent>
              </Card>
            ))}
          </div>
        ) : perms?.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="font-semibold text-muted-foreground">Nenhuma permissão configurada</p>
              <p className="text-sm text-muted-foreground font-light mt-1">Administradores têm acesso total por padrão</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-0 px-6 pt-5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {perms?.length} permissão{perms?.length !== 1 ? "ões" : ""} configurada{perms?.length !== 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              <div className="divide-y divide-border/40">
                {perms?.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-6 py-4 hover:bg-secondary/40 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl bg-[oklch(0.82_0.08_230/0.2)] flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{userName(p.userId)}</p>
                        <p className="text-xs text-muted-foreground">{serverName(p.serverId)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.canConnect && (
                        <Badge className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 border border-green-200">Conectar</Badge>
                      )}
                      {p.canViewCredentials && (
                        <Badge className="text-[10px] px-2 py-0.5 bg-yellow-100 text-yellow-700 border border-yellow-200">Ver senhas</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Revogar esta permissão?")) revokeMutation.mutate({ userId: p.userId, serverId: p.serverId });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Conceder Acesso</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Usuário *</Label>
              <Select value={form.userId} onValueChange={(v) => setForm({ ...form, userId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o usuário" /></SelectTrigger>
                <SelectContent>
                  {users?.filter((u) => u.role !== "admin").map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>{u.name ?? u.email ?? `#${u.id}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Servidor *</Label>
              <Select value={form.serverId} onValueChange={(v) => setForm({ ...form, serverId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o servidor" /></SelectTrigger>
                <SelectContent>
                  {servers?.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.hostname}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 p-4 bg-secondary/50 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Conectar via RDP</p>
                  <p className="text-xs text-muted-foreground">Permite iniciar sessão remota</p>
                </div>
                <Switch checked={form.canConnect} onCheckedChange={(v) => setForm({ ...form, canConnect: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Ver credenciais</p>
                  <p className="text-xs text-muted-foreground">Permite revelar senhas</p>
                </div>
                <Switch checked={form.canViewCredentials} onCheckedChange={(v) => setForm({ ...form, canViewCredentials: v })} />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={grantMutation.isPending || !form.userId || !form.serverId}>
                Conceder acesso
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
