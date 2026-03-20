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
import { ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

type FormData = {
  clientId: string;
  serverId: string;
  title: string;
  url: string;
  description: string;
  category: string;
};

const emptyForm: FormData = {
  clientId: "",
  serverId: "",
  title: "",
  url: "",
  description: "",
  category: "",
};

export default function Links() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const isAdmin = user?.role === "admin";

  const utils = trpc.useUtils();
  const { data: clients } = trpc.clients.list.useQuery({});
  const { data: servers } = trpc.servers.list.useQuery({});
  const { data: links, isLoading } = trpc.links.list.useQuery({});

  const createMutation = trpc.links.create.useMutation({
    onSuccess: () => { utils.links.list.invalidate(); toast.success("Link criado!"); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.links.delete.useMutation({
    onSuccess: () => { utils.links.list.invalidate(); toast.success("Link removido!"); },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      clientId: form.clientId ? parseInt(form.clientId) : undefined,
      serverId: form.serverId ? parseInt(form.serverId) : undefined,
      title: form.title,
      url: form.url,
      description: form.description || undefined,
      category: form.category || undefined,
    });
  }

  const clientName = (id: number | null) => id ? clients?.find((c) => c.id === id)?.name ?? "-" : null;
  const serverName = (id: number | null) => id ? servers?.find((s) => s.id === id)?.hostname ?? "-" : null;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Links Importantes</h1>
            <p className="text-muted-foreground font-light mt-1">Acesso rápido a recursos e sistemas</p>
          </div>
          {isAdmin && (
            <Button onClick={() => { setForm(emptyForm); setOpen(true); }} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Novo Link
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-5"><Skeleton className="h-5 w-48 mb-2" /><Skeleton className="h-4 w-32" /></CardContent>
              </Card>
            ))}
          </div>
        ) : links?.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <Link2 className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="font-semibold text-muted-foreground">Nenhum link cadastrado</p>
              {isAdmin && (
                <Button onClick={() => { setForm(emptyForm); setOpen(true); }} className="mt-4 gap-2" size="sm">
                  <Plus className="h-4 w-4" />
                  Adicionar link
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {links?.map((l) => (
              <Card key={l.id} className="border-0 shadow-sm card-hover group">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[oklch(0.82_0.08_230/0.15)] flex items-center justify-center shrink-0">
                        <Link2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base">{l.title}</h3>
                          {l.category && (
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{l.category}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {l.url.length > 50 ? l.url.substring(0, 50) + "..." : l.url}
                          </a>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {clientName(l.clientId) && (
                            <span className="text-xs text-muted-foreground">Cliente: {clientName(l.clientId)}</span>
                          )}
                          {serverName(l.serverId) && (
                            <span className="text-xs text-muted-foreground">Servidor: {serverName(l.serverId)}</span>
                          )}
                          {l.description && (
                            <span className="text-xs text-muted-foreground">{l.description}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => window.open(l.url, "_blank")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Remover link "${l.title}"?`)) deleteMutation.mutate({ id: l.id });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Novo Link</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Ex: Painel de Controle, VPN..." />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>URL *</Label>
                <Input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required placeholder="https://..." />
              </div>
              <div className="space-y-1.5">
                <Label>Cliente (opcional)</Label>
                <Select value={form.clientId || "none"} onValueChange={(v) => setForm({ ...form, clientId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clients?.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Servidor (opcional)</Label>
                <Select value={form.serverId || "none"} onValueChange={(v) => setForm({ ...form, serverId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {servers?.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.hostname}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="VPN, Firewall, ERP..." />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Descrição do link..." />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>Criar link</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
