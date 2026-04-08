"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Plane,
  Brain,
  Clock,
  ArrowRight,
  Sparkles,
  MapPin,
  AlertTriangle,
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Leitura de Agenda",
    description: "Conecta com Google Calendar e detecta automaticamente eventos que exigem viagem.",
  },
  {
    icon: Brain,
    title: "Itinerario Inteligente",
    description: "IA gera o itinerario completo: voo, hotel, transporte terrestre e conflitos.",
  },
  {
    icon: Plane,
    title: "Reserva na Onfly",
    description: "Busca real de voos e hoteis via Onfly, com link direto para checkout.",
  },
  {
    icon: AlertTriangle,
    title: "Resolucao de Conflitos",
    description: "Detecta conflitos na agenda e sugere solucoes com um clique.",
  },
  {
    icon: MapPin,
    title: "Mobilidade Porta-a-Porta",
    description: "Planeja cada trecho: casa ate o aeroporto, aeroporto ate a reuniao.",
  },
  {
    icon: Sparkles,
    title: "Bleisure com OnHappy",
    description: "Identifica oportunidades de estender a viagem no fim de semana.",
  },
];

export function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* Hero */}
      <main className="flex-1">
        <section className="relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 gradient-hero" />
          <div className="absolute left-1/2 top-1/4 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-onfly/5 blur-[120px]" />

          <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-20 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-onfly/20 bg-onfly/5 px-4 py-1.5 text-sm text-onfly mb-8">
              <Clock className="h-4 w-4" />
              Powered by Onfly
            </div>

            <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Sua agenda vira
              <br />
              <span className="text-gradient-onfly">itinerario automatico</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted leading-relaxed">
              OnTime le seus compromissos, detecta viagens, monta o itinerario completo
              com voos, hoteis e transporte — e resolve conflitos de agenda. Tudo com IA.
            </p>

            <div className="mt-10 flex items-center justify-center gap-4">
              <Button size="xl" asChild>
                <a href="/api/auth/onfly">
                  Entrar com Onfly
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
            </div>

            <p className="mt-4 text-sm text-subtle">
              Login seguro via OAuth2. Seus dados ficam protegidos.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-7xl px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">Como funciona</h2>
            <p className="mt-3 text-muted">
              Do compromisso na agenda ate a reserva na Onfly, em minutos.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <div key={i} className="glow-card p-6 tilt-card">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg gradient-onfly-soft">
                  <feature.icon className="h-5 w-5 text-onfly" />
                </div>
                <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-6 pb-24">
          <div className="glow-card glow-card-orange p-12 text-center gradient-onhappy-soft">
            <h2 className="text-2xl font-bold mb-3">
              Pronto para automatizar suas viagens?
            </h2>
            <p className="text-muted mb-8 max-w-xl mx-auto">
              Conecte sua agenda, defina suas preferencias e deixe o OnTime fazer o resto.
            </p>
            <Button variant="onhappy" size="lg" asChild>
              <a href="/api/auth/onfly">
                Comecar agora
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-subtle">
            <Clock className="h-4 w-4" />
            OnTime by Onfly
          </div>
          <p className="text-xs text-subtle">
            Hackathon Onfly Tech 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
