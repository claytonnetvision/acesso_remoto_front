import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { trpc } from "@/lib/trpc";
import { Activity, Search } from "lucide-react";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

const actionConfig: Record<string, { label: string; cls: string }> = {
  connect: { label: "Conexão RDP", cls: "bg-green-100 text-green-700 border-green-200" },
  disconnect: { label: "Desconexão", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  view_credentials: { label: "Ver credenciais", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  create: { label: "Criação", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  update: { label: "Atualização", cls: "bg-purple-100 text-purple-700 border-purple-200" },
  delete: { label: "Exclusão", cls: "bg-red-100 text-red-700 border-red-200" },
};

export default function Logs() {
  const [filterAction, setFilterAction] = useState("all");
  const [search, setSearch] = useState("");

  const { data: logs, isLoading } = trpc.logs.list.useQuery({ limit: 200 });

  const filtered = logs?.filter((l) => {
    const matchAction = filterAction === "all" || l.action === filterAction;
    const matchSearch = !search || (l.details ?? "").toLowerCase().includes(search.toLowerCase());
    return matchAction && matchSearch;
  });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logs de Auditoria</h1>
          <p className="text-muted-foreground font-light mt-1">
            Histórico completo de ações e acessos no sistema
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nos detalhes..."
              className="pl-9 bg-card border-border/60 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-48 bg-card border-border/60 shadow-sm">
              <SelectValue placeholder="Tipo de ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {Object.entries(actionConfig).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-0 px-6 pt-5">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              {filtered?.length ?? 0} registro{filtered?.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-4">
            {isLoading ? (
              <div className="px-6 pb-6 space-y-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-6 w-28 rounded-md" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : filtered?.length === 0 ? (
              <div className="py-16 text-center">
                <Activity className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="font-semibold text-muted-foreground">Nenhum registro encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-secondary/50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ação</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detalhes</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recurso</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filtered?.map((log) => {
                      const ac = actionConfig[log.action] ?? { label: log.action, cls: "bg-gray-100 text-gray-600 border-gray-200" };
                      return (
                        <tr key={log.id} className="hover:bg-secondary/40 transition-colors">
                          <td className="px-6 py-3">
                            <Badge className={`text-[10px] px-2 py-0.5 border font-semibold ${ac.cls}`}>
                              {ac.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                            {log.details ?? "-"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {log.resourceType ?? "-"}
                            {log.resourceId ? ` #${log.resourceId}` : ""}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
