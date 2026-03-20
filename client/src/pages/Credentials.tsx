import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Check,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  FileKey,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

type FormData = {
  serverId: string;
  label: string;
  username: string;
  password: string;
  domain: string;
  notes: string;
  isDefault: boolean;
};

const emptyForm: FormData = {
  serverId: "",
  label: "",
  username: "",
  password: "",
  domain: "",
  notes: "",
  isDefault: false,
};

export default function Credentials() {
  const { user } = useAuth();
  const [selectedServer, setSelectedServer] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const isAdmin = user?.role === "admin";

  const utils = trpc.useUtils();
  const { data: servers } = trpc.servers.list.useQuery({});
  const { data: creds, isLoading } = trpc.credentials.listByServer.useQuery(
    { serverId: parseInt(selectedServer) },
    { enabled: selectedServer !== "all" }
  );

  const revealMutation = trpc.credentials.reveal.useMutation({
    onSuccess: (data, vars) => {
      setRevealedPasswords((prev) => ({ ...prev, [vars.id]: data.password }));
      toast.success("Senha revelada");
    },
    onError: (e) => toast.error(e.message),
  });

  const createMutation = trpc.credentials.create.useMutation({
    onSuccess: () => {
      if (selectedServer !== "all") utils.credentials.listByServer.invalidate({ serverId: parseInt(selectedServer) });
      toast.success("Credencial criada!");
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.credentials.update.useMutation({
    onSuccess: () => {
      if (selectedServer !== "all") utils.credentials.listByServer.invalidate({ serverId: parseInt(selectedServer) });
      toast.success("Credencial atualizada!");
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.credentials.delete.useMutation({
    onSuccess: () => {
      if (selectedServer !== "all") utils.credentials.listByServer.invalidate({ serverId: parseInt(selectedServer) });
      toast.success("Credencial removida!");
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditId(null);
    setForm({ ...emptyForm, serverId: selectedServer !== "all" ? selectedServer : "" });
    setOpen(true);
  }

  function openEdit(c: NonNullable<typeof creds>[0]) {
    setEditId(c.id);
    setForm({
      serverId: c.serverId.toString(),
      label: c.label,
      username: c.username,
      password: "",
      domain: c.domain ?? "",
      notes: c.notes ?? "",
      isDefault: c.isDefault,
    });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      updateMutation.mutate({
        id: editId,
        label: form.label,
        username: form.username,
        password: form.password || undefined,
        domain: form.domain || undefined,
        notes: form.notes || undefined,
        isDefault: form.isDefault,
      });
    } else {
      createMutation.mutate({
        serverId: parseInt(form.serverId),
        label: form.label,
        username: form.username,
        password: form.password,
        domain: form.domain || undefined,
        notes: form.notes || undefined,
        isDefault: form.isDefault,
      });
    }
  }

  async function copyToClipboard(text: string, id: number) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("Copiado!");
    setTimeout(() => setCopied(null), 2000);
  }

  const serverName = (id: number) => servers?.find((s) => s.id === id)?.hostname ?? "-";

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Credenciais</h1>
            <p className="text-muted-foreground font-light mt-1">Gerenciamento seguro de senhas e acessos</p>
          </div>
          {isAdmin && selectedServer !== "all" && (
            <Button onClick={openCreate} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Nova Credencial
            </Button>
          )}
        </div>

        {/* Server selector */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileKey className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Selecione o servidor</Label>
                <Select value={selectedServer} onValueChange={setSelectedServer}>
                  <SelectTrigger className="border-border/60">
                    <SelectValue placeholder="Escolha um servidor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">-- Selecione um servidor --</SelectItem>
                    {servers?.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.hostname} ({s.ipAddress})
                      </SelectItem>
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
              <FileKey className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="font-semibold text-muted-foreground">Selecione um servidor</p>
              <p className="text-sm text-muted-foreground font-light mt-1">Escolha um servidor acima para ver suas credenciais</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="grid gap-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : creds?.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <FileKey className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="font-semibold text-muted-foreground">Nenhuma credencial cadastrada</p>
              {isAdmin && (
                <Button onClick={openCreate} className="mt-4 gap-2" size="sm">
                  <Plus className="h-4 w-4" />
                  Adicionar credencial
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {creds?.map((c) => {
              const revealed = revealedPasswords[c.id];
              return (
                <Card key={c.id} className="border-0 shadow-sm card-hover group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[oklch(0.88_0.06_350/0.2)] flex items-center justify-center shrink-0">
                          <FileKey className="h-5 w-5 text-[oklch(0.45_0.1_350)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base">{c.label}</h3>
                            {c.isDefault && (
                              <Badge className="text-[10px] px-2 py-0.5 bg-yellow-100 text-yellow-700 border border-yellow-200 gap-1">
                                <Star className="h-2.5 w-2.5" />
                                Padrão
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-16 shrink-0">Usuário</span>
                              <span className="text-xs font-mono font-semibold">{c.username}</span>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => copyToClipboard(c.username, c.id * 100)}
                              >
                                {copied === c.id * 100 ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                              </button>
                            </div>
                            {c.domain && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-16 shrink-0">Domínio</span>
                                <span className="text-xs font-mono">{c.domain}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-16 shrink-0">Senha</span>
                              <span className="text-xs font-mono">
                                {revealed ? (showPassword ? revealed : "••••••••") : "••••••••"}
                              </span>
                              {revealed ? (
                                <>
                                  <button onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                                  </button>
                                  <button
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => copyToClipboard(revealed, c.id)}
                                  >
                                    {copied === c.id ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="text-xs text-primary hover:underline font-medium"
                                  onClick={() => revealMutation.mutate({ id: c.id })}
                                  disabled={revealMutation.isPending}
                                >
                                  Revelar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Remover credencial "${c.label}"?`)) deleteMutation.mutate({ id: c.id });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
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
              {editId ? "Editar Credencial" : "Nova Credencial"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
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
              <div className="col-span-2 space-y-1.5">
                <Label>Rótulo *</Label>
                <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required placeholder="Ex: Administrador, Suporte..." />
              </div>
              <div className="space-y-1.5">
                <Label>Usuário *</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required placeholder="administrator" />
              </div>
              <div className="space-y-1.5">
                <Label>Domínio</Label>
                <Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="EMPRESA" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{editId ? "Nova senha (deixe em branco para manter)" : "Senha *"}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editId}
                  placeholder="••••••••"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Informações adicionais..." />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <Switch
                  checked={form.isDefault}
                  onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
                />
                <Label className="cursor-pointer">Credencial padrão para este servidor</Label>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editId ? "Salvar" : "Criar credencial"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
