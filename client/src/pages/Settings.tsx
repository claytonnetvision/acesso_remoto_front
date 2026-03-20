import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, Server, Shield, Wifi, Database, Info } from "lucide-react";

export default function Settings() {
  const frpServer = import.meta.env.VITE_FRP_SERVER_ADDR ?? "31.97.16.12";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="w-6 h-6" /> Configurações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Informações do sistema e configurações gerais
          </p>
        </div>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="w-4 h-4" /> Informações do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Aplicação</span>
              <span className="text-sm font-medium">Remote Access Manager</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Versão</span>
              <Badge variant="secondary">v1.0.0</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Banco de Dados</span>
              <Badge variant="outline" className="text-green-600 border-green-300">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
                PostgreSQL (Neon)
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* FRP Config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wifi className="w-4 h-4" /> Configuração do Servidor FRP
            </CardTitle>
            <CardDescription>
              Endereço e portas do servidor de túnel reverso (VPS Hostinger)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Endereço do Servidor</span>
              <code className="text-sm bg-muted px-2 py-0.5 rounded">{frpServer}</code>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Porta Moderna (frpc v0.61.1)</span>
              <code className="text-sm bg-muted px-2 py-0.5 rounded">7000</code>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Porta Legacy (frpc v0.51.3)</span>
              <code className="text-sm bg-muted px-2 py-0.5 rounded">7001</code>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Range de Portas RDP</span>
              <code className="text-sm bg-muted px-2 py-0.5 rounded">20000 – 29999</code>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Range de Portas Métricas</span>
              <code className="text-sm bg-muted px-2 py-0.5 rounded">21000 – 21999</code>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Dashboard FRP</span>
              <a
                href={`http://${frpServer}:7500`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline underline-offset-2"
              >
                {frpServer}:7500
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Agent Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="w-4 h-4" /> Agente de Acesso Remoto
            </CardTitle>
            <CardDescription>
              Informações sobre os binários do agente frpc
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Agente Moderno</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">frpc v0.61.1</Badge>
                <span className="text-xs text-muted-foreground">WS2016+, Win10/11</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Agente Legacy</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">frpc v0.51.3</Badge>
                <span className="text-xs text-muted-foreground">WS2008 R2, WS2012 R2, Win7</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Agente de Métricas</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">metrics-agent.ps1</Badge>
                <span className="text-xs text-muted-foreground">PowerShell, porta 9182</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Download dos Binários</span>
              <a
                href={`http://${frpServer}/frpc.exe`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline underline-offset-2"
              >
                http://{frpServer}/frpc.exe
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-4 h-4" /> Segurança
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Autenticação FRP</span>
              <Badge variant="outline" className="text-green-600 border-green-300">Token Global</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Criptografia de Credenciais</span>
              <Badge variant="outline" className="text-green-600 border-green-300">AES-256</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Sessões</span>
              <Badge variant="outline" className="text-green-600 border-green-300">JWT + Cookie HttpOnly</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
