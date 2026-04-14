"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Shield,
  Clock,
  Zap,
} from "lucide-react";

interface CalendarContentProps {
  hasGoogleCalendar: boolean;
}

export function CalendarContent({ hasGoogleCalendar }: CalendarContentProps) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/calendar/events");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-[-0.03em] mb-1">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie suas conexões de agenda para detectar viagens automaticamente.
        </p>
      </div>

      {/* Providers */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Google Calendar */}
        <Card className="border-border/50 hover:border-border transition-all duration-300 overflow-hidden">
          <div className={cn("p-1.5", hasGoogleCalendar ? "bg-emerald-500" : "gradient-onfly")}>
            <div className="flex items-center gap-2 px-3 py-1">
              <div className="w-2 h-2 rounded-full bg-primary-foreground/40" />
              <div className="w-2 h-2 rounded-full bg-primary-foreground/40" />
              <div className="w-2 h-2 rounded-full bg-primary-foreground/40" />
              <span className="text-xs text-primary-foreground/80 ml-2 font-medium">Google Calendar</span>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <img src="/calendar-new.svg" alt="Google Calendar" className="w-12 h-12" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Google Calendar</h3>
                <p className="text-sm text-muted-foreground">Sincronize eventos automaticamente</p>
              </div>
              <Badge className={cn("border-0 text-xs", hasGoogleCalendar ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground")}>
                {hasGoogleCalendar ? "Conectado" : "Desconectado"}
              </Badge>
            </div>

            {hasGoogleCalendar ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-muted-foreground">Conexão ativa · Eventos dos próximos 60 dias</span>
                </div>
                <Button onClick={handleSync} disabled={syncing} variant="outline" className="w-full">
                  <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
                  {syncing ? "Sincronizando..." : "Sincronizar agora"}
                </Button>
              </div>
            ) : (
              <Button asChild className="w-full">
                <a href="/api/auth/google">
                  Conectar Google Calendar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Microsoft 365 */}
        <Card className="border-border/50 opacity-60">
          <div className="p-1.5 bg-muted">
            <div className="flex items-center gap-2 px-3 py-1">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
              <span className="text-xs text-muted-foreground/80 ml-2 font-medium">Microsoft 365</span>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <img src="/teams-new.svg" alt="Microsoft Teams" className="w-12 h-12" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Microsoft 365</h3>
                <p className="text-sm text-muted-foreground">Outlook e Teams integrados</p>
              </div>
              <Badge variant="outline" className="text-xs">Em breve</Badge>
            </div>
            <Button disabled className="w-full" variant="secondary">
              Em breve
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">Como funciona a sincronização</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Calendar, title: "Leitura de eventos", desc: "Escaneamos os próximos 60 dias da sua agenda" },
              { icon: Zap, title: "Detecção por IA", desc: "Claude identifica quais eventos exigem viagem" },
              { icon: Clock, title: "Bloqueio de agenda", desc: "Eventos de deslocamento são criados automaticamente" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security note */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-muted/30">
        <Shield className="w-5 h-5 text-primary shrink-0" />
        <div>
          <p className="text-sm font-medium">Segurança de dados</p>
          <p className="text-xs text-muted-foreground">Seus dados de agenda são processados localmente e nunca compartilhados com terceiros. Conexão OAuth2 segura.</p>
        </div>
      </div>
    </div>
  );
}
