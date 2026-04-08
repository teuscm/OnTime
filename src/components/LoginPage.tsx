"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { useCountUp } from "@/hooks/useCountUp";
import { useMouseGlow, useTiltCard } from "@/hooks/useMouseGlow";
import {
  Plane, Bus, Coffee, Hotel, Clock, MapPin, ChevronRight,
  Shield, Zap, Calendar, Users, ArrowRight, Check, Star,
  Car, Sun, Briefcase, AlertTriangle, RefreshCw, Monitor, Sparkles,
} from "lucide-react";

const onlyLogo = "/onfly-new.svg";
const onhappyLogo = "/onhappy.svg";
const calendarIcon = "/calendar-new.svg";
const teamsIcon = "/teams-new.svg";
const slackIcon = "/slack-new.svg";
const chatIcon = "/chat-new.svg";

/* ─── Scroll-animated wrapper ─── */
function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollAnimation(0.12);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Glow Card ─── */
function GlowCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { ref, onMouseMove } = useMouseGlow();
  return (
    <div ref={ref} onMouseMove={onMouseMove} className={`glow-card ${className}`}>
      {children}
    </div>
  );
}

/* ─── Tilt Card ─── */
function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { ref, onMouseMove, onMouseLeave } = useTiltCard();
  return (
    <div ref={ref} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} className={`tilt-card ${className}`}>
      {children}
    </div>
  );
}

/* ─── Navbar ─── */
function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/95 backdrop-blur-lg border-b border-border/50 shadow-sm" : "bg-background/80 backdrop-blur-md"}`}>
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-2">
          <img src={onlyLogo} alt="Onfly" className="h-8" />
          <span className="font-bold text-lg">
            <span className="gradient-text">OnTime</span>
            <span className="text-muted-foreground text-sm font-normal ml-1.5">by Onfly</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {["Como Funciona", "Preferências", "Bleisure", "Integrações"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}
              className="text-sm text-muted-foreground hover:text-primary transition-colors relative group"
            >
              {item}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        <Button asChild className="hidden md:inline-flex gradient-onfly text-primary-foreground border-0 hover:opacity-90 transition-all hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5">
          <a href="/api/auth/onfly">Faça sua próxima viagem com inovação</a>
        </Button>

        <button className="md:hidden" onClick={() => setOpen(!open)}>
          <div className="space-y-1.5">
            <span className={`block w-6 h-0.5 bg-foreground transition-transform ${open ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-6 h-0.5 bg-foreground transition-opacity ${open ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-0.5 bg-foreground transition-transform ${open ? "-rotate-45 -translate-y-2" : ""}`} />
          </div>
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-background border-b border-border px-4 pb-4 space-y-3 slide-enter">
          {["Como Funciona", "Preferências", "Bleisure", "Integrações"].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(/\s/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`} className="block text-sm text-muted-foreground hover:text-primary" onClick={() => setOpen(false)}>
              {item}
            </a>
          ))}
          <Button asChild className="w-full gradient-onfly text-primary-foreground border-0">
            <a href="/api/auth/onfly">Faça sua próxima viagem com inovação</a>
          </Button>
        </div>
      )}
    </nav>
  );
}

/* ─── Hero with Trip Mockup ─── */
function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <img src={calendarIcon} alt="" className="absolute top-24 right-[15%] w-12 h-12 opacity-20 animate-float hidden lg:block" />
      <img src={teamsIcon} alt="" className="absolute top-40 left-[10%] w-10 h-10 opacity-15 animate-[float_3s_ease-in-out_1.5s_infinite] hidden lg:block" />
      <img src={slackIcon} alt="" className="absolute bottom-20 right-[20%] w-8 h-8 opacity-10 animate-float hidden lg:block" />
      <div className="absolute top-32 right-[8%] w-64 h-64 rounded-full gradient-onfly-soft blur-3xl" />
      <div className="absolute bottom-0 left-[5%] w-48 h-48 rounded-full bg-secondary/10 blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <Badge variant="secondary" className="mb-6 bg-primary/10 text-primary border-primary/20 px-4 py-1.5">
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Assistente de Viagens com IA
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Sua agenda marca o compromisso,{" "}
              <span className="gradient-text">o OnTime cuida da viagem.</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mb-8">
              Itinerário completo — voo, hotel e mobilidade — montado automaticamente
              em segundos a partir da sua agenda corporativa.
            </p>

            <div className="flex flex-col sm:flex-row items-center lg:items-start gap-4 mb-8">
              <Button asChild size="lg" className="gradient-onfly text-primary-foreground border-0 hover:opacity-90 px-8 text-base animate-pulse-glow hover:shadow-xl hover:shadow-primary/25 transition-all hover:-translate-y-0.5">
                <a href="/api/auth/onfly">
                  Faça sua próxima viagem com inovação
                  <ArrowRight className="ml-2 w-4 h-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="text-base hover:-translate-y-0.5 transition-all" asChild>
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
              {[
                { icon: Clock, text: "40 min economizados" },
                { icon: Zap, text: "Reservas automáticas" },
                { icon: Shield, text: "100% compliance" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <item.icon className="w-4 h-4 text-primary" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <AnimatedSection delay={300}>
            <TiltCard>
              <Card className="shadow-2xl border-primary/10 overflow-hidden">
                <div className="p-1.5 gradient-onfly">
                  <div className="flex items-center gap-2 px-3 py-1">
                    <div className="w-2 h-2 rounded-full bg-primary-foreground/40" />
                    <div className="w-2 h-2 rounded-full bg-primary-foreground/40" />
                    <div className="w-2 h-2 rounded-full bg-primary-foreground/40" />
                    <span className="text-xs text-primary-foreground/80 ml-2 font-medium">OnTime — Próxima Viagem</span>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Origem</p>
                      <p className="text-lg font-bold">GRU</p>
                      <p className="text-xs text-muted-foreground">São Paulo</p>
                    </div>
                    <div className="flex-1 flex items-center justify-center px-4">
                      <div className="w-full h-px bg-border relative">
                        <Plane className="w-4 h-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-0.5" />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Destino</p>
                      <p className="text-lg font-bold">REC</p>
                      <p className="text-xs text-muted-foreground">Recife</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { time: "08:00", label: "Uber para GRU", icon: Car, tag: "Mobilidade" },
                      { time: "10:30", label: "Voo LATAM 3421", icon: Plane, tag: "Aéreo" },
                      { time: "14:00", label: "Reunião — Av. Boa Viagem", icon: Users, tag: "Agenda" },
                      { time: "18:00", label: "Hotel Atlante Plaza", icon: Hotel, tag: "Hospedagem" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <item.icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.time}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-primary/20 text-primary shrink-0">{item.tag}</Badge>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 p-3 rounded-lg border border-secondary/20 bg-secondary/5">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-secondary">Sugestão IA:</span> Voo 30min mais cedo evita conflito com reunião das 14h. Hotel com café incluso economiza R$ 35/dia.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TiltCard>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

/* ─── Impact Metrics ─── */
function ImpactMetrics() {
  const { ref, isVisible } = useScrollAnimation(0.3);
  const metric1 = useCountUp(78, 1500, isVisible);
  const metric2 = useCountUp(40, 1500, isVisible);
  const metric3 = useCountUp(3200, 1500, isVisible);
  const metric4 = useCountUp(30, 1500, isVisible);

  const metrics = [
    { value: `${metric1}%`, label: "menos tempo organizando viagens" },
    { value: `${metric2} min`, label: "economizados por viagem" },
    { value: `${metric3}+`, label: "viagens processadas" },
    { value: `< ${metric4}s`, label: "para montar o itinerário" },
  ];

  return (
    <section ref={ref} className="py-16 border-y border-border/50 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
          {metrics.map((m, i) => (
            <AnimatedSection key={i} delay={i * 100} className="text-center">
              <p className="text-3xl sm:text-4xl font-bold gradient-text">{m.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{m.label}</p>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Sem OnTime vs Com OnTime ─── */
function ProblemSolution() {
  const { ref, isVisible } = useScrollAnimation(0.3);
  const withoutTime = useCountUp(40, 1200, isVisible);
  const withTime = useCountUp(30, 1200, isVisible);

  const withoutItems = [
    { icon: Clock, text: "Cotação manual de voos e hotéis" },
    { icon: Calendar, text: "Conciliar agenda com itinerário" },
    { icon: MapPin, text: "Criar eventos de deslocamento manualmente" },
    { icon: Coffee, text: "Hotel sem café (de novo)" },
  ];

  const withItems = [
    { icon: Zap, text: "Cotação automática em segundos" },
    { icon: Calendar, text: "Eventos de deslocamento criados na agenda" },
    { icon: Car, text: "Trajeto até o aeroporto já agendado" },
    { icon: Star, text: "Hands free — suas preferências, sempre" },
  ];

  return (
    <section className="py-24" ref={ref}>
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">
            A diferença é <span className="gradient-text">clara</span>
          </h2>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-10 max-w-5xl mx-auto">
          <AnimatedSection>
            <GlowCard className="relative rounded-2xl border border-destructive/15 bg-destructive/[0.03] p-8 h-full">
              <div className="absolute -top-3 right-6">
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 shadow-md px-3 py-1">Modelo antigo</Badge>
              </div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <h3 className="text-lg font-bold text-destructive/80 tracking-wide">Sem OnTime</h3>
              </div>
              <div className="space-y-5">
                {withoutItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-destructive/8 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <item.icon className="w-5 h-5 text-destructive/60" />
                    </div>
                    <span className="text-muted-foreground font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-destructive/10">
                <p className="text-2xl font-bold text-destructive/70">{withoutTime}+ min</p>
                <p className="text-sm text-muted-foreground">por viagem organizada</p>
              </div>
            </GlowCard>
          </AnimatedSection>

          <AnimatedSection delay={150}>
            <TiltCard className="h-full">
              <GlowCard className="rounded-2xl border border-primary/20 gradient-onfly-soft p-8 h-full shadow-lg shadow-primary/5">
                <div className="absolute -top-3 right-6">
                  <Badge className="gradient-onfly text-primary-foreground border-0 shadow-md px-3 py-1">Recomendado</Badge>
                </div>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <h3 className="text-lg font-bold text-primary tracking-wide">Com OnTime</h3>
                </div>
                <div className="space-y-5">
                  {withItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 group">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-foreground font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 pt-6 border-t border-primary/15">
                  <p className="text-2xl font-bold gradient-text inline-block">{withTime} segundos</p>
                  <p className="text-sm text-muted-foreground">do evento à reserva completa</p>
                </div>
              </GlowCard>
            </TiltCard>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

/* ─── Timeline / Como Funciona ─── */
const flowSteps = [
  { icon: Calendar, title: "Conexão de Agenda", desc: "Sincronize com Google Calendar ou Microsoft 365 em um clique." },
  { icon: MapPin, title: "Varredura de Eventos", desc: "A IA identifica local, horário e duração do compromisso automaticamente." },
  { icon: Plane, title: "Proposta de Itinerário", desc: "Receba opções de voo/ônibus, hotel e mobilidade já filtradas pela política." },
  { icon: Check, title: "Reserva em 1-Clique", desc: "Confirme tudo diretamente na Onfly, sem precisar abrir outro sistema." },
];

const timelineEvents = [
  { time: "08:00", label: "Uber solicitado para o Aeroporto", icon: Car, tag: "Mobilidade", detail: "Pickup estimado em 15 min — trajeto sincronizado com horário do voo.", aiTip: "Sugestão: saída 10 min antes evita trânsito na marginal." },
  { time: "10:30", label: "Voo Latam — Sua companhia preferida", icon: Plane, tag: "Aéreo", detail: "Assento 12A (janela) reservado automaticamente. Embarque no portão B14.", aiTip: "Voo 30 min mais cedo evita conflito com reunião das 14h." },
  { time: "13:00", label: "Reunião com cliente — Av. Paulista", icon: Users, tag: "Agenda", detail: "Evento original da agenda. Transfer do aeroporto já incluído." },
  { time: "15:00", label: "Check-in Hotel Charlie — Seu estilo favorito", icon: Hotel, tag: "Hospedagem", detail: "Café da manhã incluso. A 800m do local da reunião.", aiTip: "Hotel com café incluso economiza R$ 35/dia." },
];

const calendarEvents = [
  {
    provider: "Google Calendar", providerIcon: calendarIcon, color: "bg-primary",
    events: [
      { time: "07:45 – 08:30", title: "Deslocamento até GRU", subtitle: "Uber · Estimativa 45 min", icon: Car },
      { time: "08:30 – 09:15", title: "Check-in e embarque", subtitle: "Terminal 2 · Portão B14", icon: Briefcase },
      { time: "09:15 – 12:30", title: "Voo LATAM 3421 · GRU → REC", subtitle: "Assento 12A · Janela", icon: Plane },
      { time: "12:30 – 13:30", title: "Transfer aeroporto → reunião", subtitle: "Uber · Av. Boa Viagem", icon: Car },
    ],
  },
  {
    provider: "Microsoft 365", providerIcon: teamsIcon, color: "bg-secondary",
    events: [
      { time: "07:45 – 08:30", title: "Deslocamento até GRU", subtitle: "Uber · Rota via Marginal", icon: Car },
      { time: "08:30 – 09:15", title: "Check-in e embarque", subtitle: "Terminal 2 · Portão B14", icon: Briefcase },
      { time: "09:15 – 12:30", title: "Voo LATAM 3421 · GRU → REC", subtitle: "Assento 12A · Janela", icon: Plane },
      { time: "12:30 – 13:30", title: "Transfer aeroporto → reunião", subtitle: "Uber · Av. Boa Viagem", icon: Car },
    ],
  },
];

function AgendaCarousel() {
  const [activeProvider, setActiveProvider] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => setActiveProvider((prev) => (prev + 1) % calendarEvents.length), 4000);
    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  const current = calendarEvents[activeProvider];

  return (
    <div className="mt-10 max-w-2xl mx-auto">
      <div className="text-center mb-4">
        <p className="text-sm font-semibold text-muted-foreground">Cada etapa vira um evento real na sua agenda</p>
      </div>
      <div className="flex items-center justify-center gap-2 mb-4">
        {calendarEvents.map((provider, i) => (
          <button key={i} onClick={() => { setActiveProvider(i); setIsAutoPlaying(false); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeProvider === i ? "bg-primary/10 border border-primary/20 text-primary shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
            <img src={provider.providerIcon} alt="" className="w-4 h-4" />
            {provider.provider}
          </button>
        ))}
      </div>
      <TiltCard>
        <Card className="shadow-xl border-primary/10 overflow-hidden" onMouseEnter={() => setIsAutoPlaying(false)} onMouseLeave={() => setIsAutoPlaying(true)}>
          <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <img src={current.providerIcon} alt="" className="w-5 h-5" />
              <span className="text-sm font-semibold">{current.provider}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">15 mai 2025</span>
              <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">
                <Zap className="w-2.5 h-2.5 mr-1" />Criados pelo OnTime
              </Badge>
            </div>
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {current.events.map((ev, i) => (
                <div key={`${activeProvider}-${i}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-all duration-300 group animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className={`w-1 h-10 rounded-full ${current.color} opacity-60`} />
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <ev.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">{ev.subtitle}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{ev.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
          <div className="px-5 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground text-center">
              <Shield className="w-3 h-3 inline mr-1 text-primary" />
              Horários bloqueados impedem reuniões de serem marcadas enquanto você viaja
            </p>
          </div>
        </Card>
      </TiltCard>
      <div className="flex justify-center gap-2 mt-4">
        {calendarEvents.map((_, i) => (
          <button key={i} onClick={() => { setActiveProvider(i); setIsAutoPlaying(false); }} className={`h-1.5 rounded-full transition-all duration-300 ${activeProvider === i ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
        ))}
      </div>
    </div>
  );
}

function FlowSection() {
  const [activeEvent, setActiveEvent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => setActiveEvent((prev) => (prev + 1) % timelineEvents.length), 3500);
    return () => clearInterval(timer);
  }, [isPaused]);

  return (
    <section id="como-funciona" className="py-20">
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">Como Funciona</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Do compromisso à reserva em <span className="gradient-text">4 passos</span></h2>
          <p className="text-muted-foreground max-w-xl mx-auto">O OnTime transforma eventos da sua agenda em itinerários completos.</p>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto mb-20">
          {flowSteps.map((s, i) => (
            <AnimatedSection key={i} delay={i * 150}>
              <TiltCard>
                <GlowCard className="rounded-xl border bg-card hover:shadow-lg transition-all duration-300 h-full">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 rounded-2xl gradient-onfly flex items-center justify-center mx-auto mb-4">
                      <s.icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <span className="text-xs font-bold text-primary mb-2 block">PASSO {i + 1}</span>
                    <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </CardContent>
                </GlowCard>
              </TiltCard>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection className="max-w-2xl mx-auto">
          <h3 className="text-xl font-semibold text-center mb-8">Seu dia, montado automaticamente</h3>
          <div className="flex gap-1.5 mb-6">
            {timelineEvents.map((_, i) => (
              <button key={i} onClick={() => { setActiveEvent(i); setIsPaused(true); }} className="flex-1 h-1 rounded-full overflow-hidden bg-muted cursor-pointer">
                <div className={`h-full rounded-full transition-all duration-300 ${i < activeEvent ? "bg-primary w-full" : i === activeEvent ? "bg-primary" : "w-0"}`} style={i === activeEvent && !isPaused ? { animation: "progress 3.5s linear forwards" } : i < activeEvent ? { width: "100%" } : { width: "0%" }} />
              </button>
            ))}
          </div>
          <div className="space-y-0" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
            {timelineEvents.map((ev, i) => (
              <button key={i} onClick={() => { setActiveEvent(i); setIsPaused(true); }} className={`w-full flex items-start gap-4 p-4 rounded-xl text-left transition-all duration-300 ${activeEvent === i ? "gradient-onfly-soft border border-primary/20 shadow-sm" : "hover:bg-muted/50"}`}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${activeEvent === i ? "gradient-onfly scale-110" : "bg-muted"}`}>
                    <ev.icon className={`w-4 h-4 transition-colors ${activeEvent === i ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  </div>
                  {i < timelineEvents.length - 1 && <div className={`w-0.5 h-8 mt-1 transition-colors ${i < activeEvent ? "bg-primary" : "bg-border"}`} />}
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-primary">{ev.time}</span>
                    <Badge variant="outline" className="text-xs border-primary/20 text-primary">{ev.tag}</Badge>
                  </div>
                  <p className={`text-sm transition-colors ${activeEvent === i ? "text-foreground font-medium" : "text-muted-foreground"}`}>{ev.label}</p>
                  {activeEvent === i && (
                    <div className="slide-enter">
                      <p className="text-xs text-muted-foreground mt-1.5">{ev.detail}</p>
                      {ev.aiTip && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-secondary">
                          <Sparkles className="w-3 h-3" /><span>{ev.aiTip}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
          <AgendaCarousel />
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ─── Conflict Resolution ─── */
function ConflictResolution() {
  const conflicts = [
    { time: "10:00 – 11:00", event: "Daily de produto", conflict: "Embarque GRU às 10:30", action: "Participar remoto", actionIcon: Monitor, status: "resolved" as const },
    { time: "14:00 – 15:00", event: "Review com diretoria", conflict: "Chegada REC às 13:45", action: "Mover para 15:30", actionIcon: RefreshCw, status: "resolved" as const },
    { time: "16:00 – 17:00", event: "1:1 com gestor", conflict: "Reunião presencial no destino", action: "Sem conflito", actionIcon: Check, status: "ok" as const },
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-12">
          <Badge variant="outline" className="mb-4 border-secondary/30 text-secondary">Resolução Inteligente</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Conflitos resolvidos <span className="gradient-text">antes de acontecer</span></h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">A viagem bloqueia sua agenda. O OnTime detecta conflitos e sugere reagendamentos — nada é movido sem sua confirmação.</p>
        </AnimatedSection>

        <AnimatedSection className="max-w-3xl mx-auto">
          <TiltCard>
            <Card className="shadow-xl border-primary/10 overflow-hidden">
              <div className="p-3 border-b border-border flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg gradient-onfly flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">2 conflitos detectados</p>
                  <p className="text-xs text-muted-foreground">Viagem São Paulo → Recife · 15 mai 2025</p>
                </div>
              </div>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {conflicts.map((c, i) => (
                    <AnimatedSection key={i} delay={i * 150}>
                      <div className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors group">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${c.status === "ok" ? "bg-primary/10" : "bg-secondary/10"}`}>
                          <c.actionIcon className={`w-4 h-4 ${c.status === "ok" ? "text-primary" : "text-secondary"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium truncate">{c.event}</p>
                            <span className="text-xs text-muted-foreground shrink-0">{c.time}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{c.conflict}</p>
                        </div>
                        <Badge variant="outline" className={`text-xs shrink-0 ${c.status === "ok" ? "border-primary/20 text-primary" : "border-secondary/20 text-secondary"}`}>{c.action}</Badge>
                      </div>
                    </AnimatedSection>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TiltCard>
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ─── Preferences ─── */
function PreferencesSection() {
  const [transport, setTransport] = useState<"aereo" | "onibus">("aereo");
  const [breakfast, setBreakfast] = useState(true);
  const [windowSeat, setWindowSeat] = useState(true);

  return (
    <section id="preferencias" className="py-20">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          <AnimatedSection>
            <Badge variant="outline" className="mb-4 border-secondary/30 text-secondary">Onboarding Inteligente</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">O OnTime <span className="gradient-text">aprende</span> suas preferências</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">Na primeira vez, você define seu perfil. Depois, o OnTime descarta automaticamente opções que não combinam com você — eliminando a fadiga de decisão a cada viagem.</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Check className="w-4 h-4 text-primary" /> Sempre café da manhã? Hotéis sem café somem da lista.</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2"><Check className="w-4 h-4 text-primary" /> Prefere janela? Assento A já fica selecionado.</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2"><Check className="w-4 h-4 text-primary" /> Latam sempre? Companhia prioritária na busca.</div>
          </AnimatedSection>

          <AnimatedSection delay={200}>
            <TiltCard>
              <Card className="shadow-xl border-primary/10">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg gradient-onfly flex items-center justify-center"><Star className="w-4 h-4 text-primary-foreground" /></div>
                      <h3 className="font-semibold">Suas Preferências</h3>
                    </div>
                    <Badge variant="outline" className="text-xs border-primary/20 text-primary">Passo 2 de 4</Badge>
                  </div>
                  <div className="mb-6">
                    <label className="text-sm font-medium text-muted-foreground mb-3 block">Tipo de transporte preferido</label>
                    <div className="flex rounded-xl bg-muted p-1 gap-1">
                      <button onClick={() => setTransport("aereo")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${transport === "aereo" ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                        <Plane className="w-4 h-4" /> Aéreo
                      </button>
                      <button onClick={() => setTransport("onibus")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${transport === "onibus" ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                        <Bus className="w-4 h-4" /> Ônibus
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                      <div className="flex items-center gap-3"><Coffee className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Café da manhã obrigatório</span></div>
                      <Switch checked={breakfast} onCheckedChange={setBreakfast} />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                      <div className="flex items-center gap-3"><Plane className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Assento na janela</span></div>
                      <Switch checked={windowSeat} onCheckedChange={setWindowSeat} />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                      <div className="flex items-center gap-3"><Hotel className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Hotel até 2 km do evento</span></div>
                      <Switch checked={true} />
                    </div>
                  </div>
                  <div className="mt-6 p-3 rounded-lg border border-primary/10 gradient-onfly-soft">
                    <p className="text-xs text-muted-foreground"><Zap className="w-3.5 h-3.5 inline mr-1 text-primary" />Suas preferências são aplicadas automaticamente em cada nova busca.</p>
                  </div>
                </CardContent>
              </Card>
            </TiltCard>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

/* ─── Bleisure (OnHappy) ─── */
function Bleisure() {
  return (
    <section id="bleisure" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <AnimatedSection>
          <TiltCard>
            <Card className="max-w-4xl mx-auto overflow-hidden border-0 shadow-2xl">
              <div className="relative p-8 sm:p-12 gradient-onhappy-soft">
                <div className="absolute top-4 right-4"><img src={onhappyLogo} alt="OnHappy" className="h-6" /></div>
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Sun className="w-6 h-6 text-secondary" />
                      <h2 className="text-2xl sm:text-3xl font-bold">Estenda sua viagem. <span className="gradient-text">Viva a cidade.</span></h2>
                    </div>
                    <p className="text-muted-foreground mb-6 leading-relaxed">Sua reunião acaba na sexta? Que tal voltar no domingo e aproveitar a cidade? A passagem de volta é por conta da empresa, e a hospedagem extra você garante com tarifas exclusivas na <strong className="text-secondary"> OnHappy</strong>.</p>
                    <Button className="gradient-onhappy text-primary-foreground border-0 hover:opacity-90 hover:shadow-lg hover:shadow-secondary/20 hover:-translate-y-0.5 transition-all">
                      Ver tarifas especiais<ChevronRight className="ml-1 w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Passagem de volta paga pela empresa", icon: Plane },
                      { label: "Hospedagem extra com até 60% off na OnHappy", icon: Hotel },
                      { label: "Aprovação automática no sistema", icon: Check },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-background/80 backdrop-blur hover:bg-background transition-colors group">
                        <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform"><item.icon className="w-4 h-4 text-secondary" /></div>
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </TiltCard>
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ─── Integrations ─── */
const integrations = [
  { name: "Google Calendar", img: calendarIcon, desc: "Sincronize eventos automaticamente" },
  { name: "Microsoft Teams", img: teamsIcon, desc: "Integração nativa com Office 365" },
  { name: "Slack", img: slackIcon, desc: "Notificações e aprovações no Slack" },
  { name: "Chat Onfly", img: chatIcon, desc: "Suporte direto pelo chat" },
];

function IntegrationsSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => setActiveIdx((prev) => (prev + 1) % integrations.length), 3000);
    return () => clearInterval(timer);
  }, [isPaused]);

  return (
    <section id="integracoes" className="py-20">
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-12">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">Integrações</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Conectado às ferramentas que você <span className="gradient-text">já usa</span></h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Integração segura com as principais plataformas corporativas.</p>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto mb-12" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
          {integrations.map((item, i) => (
            <AnimatedSection key={i} delay={i * 100}>
              <GlowCard className={`rounded-xl border bg-card transition-all duration-500 text-center h-full cursor-pointer ${activeIdx === i ? "shadow-xl shadow-primary/10 border-primary/30 -translate-y-2" : "hover:shadow-lg hover:-translate-y-1"}`}>
                <CardContent className="p-6" onMouseEnter={() => { setActiveIdx(i); setIsPaused(true); }}>
                  <img src={item.img} alt={item.name} className={`w-12 h-12 mx-auto mb-4 transition-transform duration-300 ${activeIdx === i ? "scale-110" : ""}`} />
                  <h3 className="font-semibold mb-1">{item.name}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </CardContent>
              </GlowCard>
            </AnimatedSection>
          ))}
        </div>

        <div className="flex justify-center gap-2 mb-12">
          {integrations.map((_, i) => (
            <button key={i} onClick={() => { setActiveIdx(i); setIsPaused(true); }} className={`w-2 h-2 rounded-full transition-all duration-300 ${activeIdx === i ? "w-6 bg-primary" : "bg-muted-foreground/30"}`} />
          ))}
        </div>

        <AnimatedSection className="text-center">
          <Card className="inline-flex items-center gap-3 px-6 py-4 border-primary/10 hover:shadow-md transition-shadow">
            <Shield className="w-5 h-5 text-primary" />
            <div className="text-left">
              <p className="text-sm font-semibold">Segurança de dados Onfly</p>
              <p className="text-xs text-muted-foreground">Criptografia ponta-a-ponta · SOC 2 · LGPD</p>
            </div>
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ─── Testimonials ─── */
function Testimonials() {
  const testimonials = [
    { quote: "Reduzi de 40 minutos para menos de 1 minuto o tempo de organização de cada viagem. O OnTime já conhece minhas preferências.", name: "Ana P.", role: "Gerente de Projetos" },
    { quote: "A resolução automática de conflitos de agenda é o que mais impressiona. Nunca mais perdi uma reunião por sobreposição com voo.", name: "Fernanda S.", role: "Diretora Comercial" },
    { quote: "Minha equipe viaja toda semana. O OnTime nos devolveu horas de produtividade que antes iam para cotação manual.", name: "Carlos M.", role: "Head de Operações" },
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-12">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">Depoimentos</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold">Quem usa, <span className="gradient-text">recomenda</span></h2>
        </AnimatedSection>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <AnimatedSection key={i} delay={i * 150}>
              <TiltCard className="h-full">
                <GlowCard className="rounded-xl border bg-card p-6 h-full flex flex-col">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: 5 }).map((_, j) => (<Star key={j} className="w-4 h-4 fill-primary text-primary" />))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-6">&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full gradient-onfly flex items-center justify-center text-primary-foreground font-bold text-sm">{t.name.charAt(0)}</div>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </GlowCard>
              </TiltCard>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ─── */
function FinalCTA() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <AnimatedSection>
          <Card className="max-w-3xl mx-auto border-0 shadow-2xl overflow-hidden">
            <div className="relative p-8 sm:p-12 text-center gradient-onfly-soft">
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-primary/5 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-secondary/5 blur-3xl" />
              <div className="relative z-10">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">Pronto para sua <span className="gradient-text">próxima viagem</span>?</h2>
                <p className="text-muted-foreground max-w-lg mx-auto mb-8">Configure em 2 minutos. Sem cadastro extra — use seu login Onfly.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                  <Button asChild size="lg" className="gradient-onfly text-primary-foreground border-0 hover:opacity-90 px-8 text-base hover:shadow-xl hover:shadow-primary/25 transition-all hover:-translate-y-0.5">
                    <a href="/api/auth/onfly">Faça sua próxima viagem com inovação<ArrowRight className="ml-2 w-4 h-4" /></a>
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /><span>Sem cadastro extra</span></div>
                  <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /><span>Setup em 2 minutos</span></div>
                  <div className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /><span>100% integrado à Onfly</span></div>
                </div>
              </div>
            </div>
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function LandingFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={onlyLogo} alt="Onfly" className="h-7" />
              <span className="font-bold">
                <span className="gradient-text">OnTime</span>
                <span className="text-muted-foreground text-xs font-normal ml-1">by Onfly</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Assistente de viagens inteligente que automatiza reservas corporativas.</p>
          </div>
          {[
            { title: "Produto", links: ["Funcionalidades", "Preços", "Roadmap", "API"] },
            { title: "Empresa", links: ["Sobre", "Blog", "Carreiras", "Contato"] },
            { title: "Legal", links: ["Privacidade", "Termos de Uso", "LGPD", "Segurança"] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="font-semibold text-sm mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors relative group">
                      {link}
                      <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-primary transition-all duration-300 group-hover:w-full" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Onfly. Todos os direitos reservados.</p>
          <p className="text-xs text-muted-foreground">Powered by <strong className="text-primary">Onfly</strong></p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ─── */
export function LoginPage() {
  return (
    <div className="min-h-screen bg-background scroll-smooth">
      <LandingNavbar />
      <Hero />
      <ImpactMetrics />
      <ProblemSolution />
      <FlowSection />
      <ConflictResolution />
      <PreferencesSection />
      <Bleisure />
      <IntegrationsSection />
      <Testimonials />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}
