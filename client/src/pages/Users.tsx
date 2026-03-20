import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Users as UsersIcon } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function Users() {
  const { data: users, isLoading } = trpc.users.list.useQuery();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground font-light mt-1">
            {users?.length ?? 0} usuário{users?.length !== 1 ? "s" : ""} no sistema
          </p>
        </div>

        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-0 px-6 pt-5">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-primary" />
              Lista de usuários
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-4">
            {isLoading ? (
              <div className="px-6 pb-6 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1.5" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : users?.length === 0 ? (
              <div className="py-16 text-center">
                <UsersIcon className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="font-semibold text-muted-foreground">Nenhum usuário cadastrado</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {users?.map((u) => (
                  <div key={u.id} className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-[oklch(0.82_0.08_230/0.2)] flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {(u.name ?? u.email ?? "U").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{u.name ?? "-"}</p>
                        <Badge
                          className={`text-[10px] px-2 py-0.5 border ${
                            u.role === "admin"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-secondary text-muted-foreground border-border"
                          }`}
                        >
                          {u.role === "admin" ? "Admin" : "Usuário"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email ?? "-"}</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Último acesso: {new Date(u.lastSignedIn).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
