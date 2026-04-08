"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Calendar,
  Plane,
  Loader2,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  MapPin,
  Clock,
  Hotel,
  Car,
  Sparkles,
  ExternalLink,
  Check,
  ChevronRight,
  RefreshCw,
  CalendarSearch,
  Zap,
  Edit3,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { CalendarEvent, ItineraryResponse, TripItinerary } from "@/types";

interface DashboardContentProps {
  hasGoogleCalendar: boolean;
  userName: string;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function DashboardContent({ hasGoogleCalendar, userName }: DashboardContentProps) {
  const [step, setStep] = useState<"connect" | "scan" | "select" | "itinerary">(
    hasGoogleCalendar ? "scan" : "connect"
  );
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [travelEvents, setTravelEvents] = useState<CalendarEvent[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [itinerary, setItinerary] = useState<ItineraryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookedTrips, setBookedTrips] = useState<Set<number>>(new Set());
  const [expandedTrips, setExpandedTrips] = useState<Set<number>>(new Set());

  const scanCalendar = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar/events");
      if (!res.ok) throw new Error("Erro ao buscar eventos");
      const data = await res.json();
      setEvents(data.data);

      const filterRes = await fetch("/api/itinerary/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: data.data }),
      });
      if (filterRes.ok) {
        const filtered = await filterRes.json();
        setTravelEvents(filtered.data);
        setSelectedEventIds(new Set(filtered.data.map((e: CalendarEvent) => e.id)));
      } else {
        const withLocation = data.data.filter((e: CalendarEvent) => e.location);
        setTravelEvents(withLocation);
        setSelectedEventIds(new Set(withLocation.map((e: CalendarEvent) => e.id)));
      }
      setStep("select");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const generateItinerary = async () => {
    setLoading(true);
    setError(null);
    try {
      const selected = travelEvents.filter((e) => selectedEventIds.has(e.id));
      const res = await fetch("/api/itinerary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ travelEvents: selected, allEvents: events }),
      });
      if (!res.ok) throw new Error("Erro ao gerar itinerario");
      const data = await res.json();
      setItinerary(data.data);
      setStep("itinerary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const toggleEvent = (id: string) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bookCalendarEvents = async (trip: TripItinerary, tripIndex: number) => {
    setError(null);
    try {
      const res = await fetch("/api/calendar/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: trip.calendarEventsToCreate }),
      });
      if (!res.ok) throw new Error("Erro ao criar eventos na agenda");
      setBookedTrips((prev) => new Set(prev).add(tripIndex));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao travar agenda");
    }
  };

  const getOnflyBookingLink = (trip: TripItinerary): string | null => {
    if (!trip.transport) return null;
    const { outbound } = trip.transport;
    const params = new URLSearchParams({
      type: "flights",
      outboundDate: outbound.suggestedDate,
    });
    return `https://app.onfly.com/travel/#/travel/booking/search?${params.toString()}`;
  };

  const toggleTripExpand = (i: number) => {
    setExpandedTrips((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-[-0.03em] mb-1">
          Olá, {userName.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {step === "connect" && "Conecte sua agenda para começar."}
          {step === "scan" && (
            <>O OnTime está pronto para escanear sua agenda dos próximos <span className="text-primary font-medium">30 dias</span>.</>
          )}
          {step === "select" && (
            <>O OnTime encontrou <span className="text-primary font-medium">{travelEvents.length} eventos</span> que podem precisar de viagem.</>
          )}
          {step === "itinerary" && "Seu itinerário está pronto."}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      {/* Stats grid (visible after scan) */}
      {(step === "select" || step === "itinerary") && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Eventos detectados", value: String(travelEvents.length), icon: CalendarSearch, accent: true },
            { label: "Itinerários planejados", value: step === "itinerary" ? String(itinerary?.trips.length ?? 0) : "—", icon: Plane, accent: true },
            { label: "Eventos totais", value: String(events.length), icon: Calendar, accent: false },
            { label: "Selecionados", value: String(selectedEventIds.size), icon: Zap, accent: true },
          ].map((stat, i) => (
            <Card key={i} className="border-border/50 hover:border-border transition-colors shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className={cn("w-4 h-4", stat.accent ? "text-primary" : "text-emerald-500")} />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                </div>
                <p className="text-xl font-bold tracking-[-0.02em]">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Calendar sync bar (visible when connected) */}
      {hasGoogleCalendar && step !== "connect" && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-muted-foreground">Google Calendar conectado</span>
          </div>
          <Button variant="ghost" size="sm" onClick={scanCalendar} disabled={loading} className="text-muted-foreground hover:text-foreground text-xs h-8">
            <RefreshCw className={cn("w-3 h-3 mr-1.5", loading && "animate-spin")} />
            Sincronizar
          </Button>
        </div>
      )}

      {/* Step: Connect Calendar */}
      {step === "connect" && (
        <Card className="max-w-lg border-primary/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl gradient-onfly flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Conectar Agenda</h3>
                <p className="text-sm text-muted-foreground">Conecte seu Google Calendar para detectar viagens automaticamente.</p>
              </div>
            </div>
            <Button asChild className="w-full">
              <a href="/api/auth/google">
                <img src="/calendar-new.svg" alt="" className="w-4 h-4" />
                Conectar Google Calendar
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <div className="mt-4 rounded-xl border border-border/50 p-4 opacity-50">
              <p className="text-sm text-muted-foreground">Microsoft Outlook — em breve</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Scan */}
      {step === "scan" && (
        <Card className="max-w-lg border-primary/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold">Google Calendar conectado</h3>
                <p className="text-sm text-muted-foreground">Pronto para escanear seus eventos dos próximos 30 dias.</p>
              </div>
            </div>
            <Button onClick={scanCalendar} disabled={loading} className="w-full">
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Escaneando...</>
              ) : (
                <>
                  <CalendarSearch className="h-4 w-4" />
                  Escanear Agenda
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step: Select travel events */}
      {step === "select" && (
        <div className="space-y-4">
          {travelEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">Nenhuma viagem detectada</h3>
                <p className="text-muted-foreground mt-2">Não encontramos eventos nos próximos 30 dias que exijam deslocamento.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarSearch className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold">Eventos que precisam de viagem</h2>
                </div>
                <span className="text-xs text-muted-foreground">Selecione os que deseja planejar</span>
              </div>

              <div className="space-y-2">
                {travelEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => toggleEvent(event.id)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left",
                      selectedEventIds.has(event.id)
                        ? "border-primary/50 bg-primary/[0.06]"
                        : "border-border/50 bg-card hover:border-border"
                    )}
                  >
                    <Checkbox
                      checked={selectedEventIds.has(event.id)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(event.start).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                        {event.location && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-0 text-[10px] shrink-0">
                      Viagem necessária
                    </Badge>
                  </button>
                ))}
              </div>

              <Button
                onClick={generateItinerary}
                disabled={loading || selectedEventIds.size === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 rounded-xl text-sm h-10 px-6 transition-all hover:-translate-y-0.5"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Gerando itinerário...</>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Planejar {selectedEventIds.size > 0 ? `${selectedEventIds.size} viagen${selectedEventIds.size > 1 ? "s" : ""}` : "selecionados"}
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Step: Itinerary */}
      {step === "itinerary" && itinerary && (
        <div className="space-y-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Itinerários planejados</h2>
            </div>
            <span className="text-xs text-muted-foreground">{itinerary.trips.length} viagens</span>
          </div>

          <div className="space-y-4">
            {itinerary.trips.map((trip, i) => {
              const isBooked = bookedTrips.has(i);
              const bookingLink = getOnflyBookingLink(trip);
              const expanded = expandedTrips.has(i);

              return (
                <Card key={i} className="border-border/50 hover:border-border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md">
                  {/* Gradient header bar */}
                  <div className={cn("p-1.5", isBooked ? "bg-emerald-500" : "gradient-onfly")}>
                    <div className="flex items-center gap-2 px-3 py-1">
                      <div className="w-2 h-2 rounded-full bg-primary-foreground/40" />
                      <div className="w-2 h-2 rounded-full bg-primary-foreground/40" />
                      <div className="w-2 h-2 rounded-full bg-primary-foreground/40" />
                      <span className="text-xs text-primary-foreground/80 ml-2 font-medium">
                        OnTime — {trip.event.title}
                      </span>
                    </div>
                  </div>

                  <button onClick={() => toggleTripExpand(i)} className="w-full p-5 text-left">
                    {/* Route display */}
                    {trip.transport && (
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Origem</p>
                          <p className="text-lg font-bold">{trip.transport.outbound.origin}</p>
                        </div>
                        <div className="flex-1 flex items-center justify-center px-4">
                          <div className="w-full h-px bg-border relative">
                            <Plane className="w-4 h-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-0.5" />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground mb-1">Destino</p>
                          <p className="text-lg font-bold">{trip.transport.outbound.destination}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px] border-0", isBooked ? "bg-emerald-500/15 text-emerald-500" : "bg-primary/15 text-primary")}>
                          {isBooked ? "Confirmada" : "Pendente"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(trip.event.datetime).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                        </span>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", expanded && "rotate-90")} />
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-border/50 animate-fade-in">
                      {/* Transport legs */}
                      {trip.transport && (
                        <div className="p-5 space-y-2">
                          {[
                            { label: `${trip.transport.outbound.origin} → ${trip.transport.outbound.destination}`, time: `${trip.transport.outbound.suggestedDate} às ${trip.transport.outbound.suggestedTime}`, icon: Plane, tag: "Ida", detail: trip.transport.outbound.reason },
                            { label: `${trip.transport.return.origin} → ${trip.transport.return.destination}`, time: `${trip.transport.return.suggestedDate} às ${trip.transport.return.suggestedTime}`, icon: Plane, tag: "Volta", detail: trip.transport.return.reason },
                          ].map((leg, j) => (
                            <div key={j} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <leg.icon className="w-4 h-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{leg.label}</p>
                                <p className="text-xs text-muted-foreground">{leg.time}</p>
                                {leg.detail && <p className="text-xs text-muted-foreground mt-0.5">{leg.detail}</p>}
                              </div>
                              <Badge variant="outline" className="text-[10px] border-primary/20 text-primary shrink-0">{leg.tag}</Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Hotel */}
                      {trip.hotel?.needed && (
                        <div className="px-5 pb-4">
                          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Hotel className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">Hospedagem</p>
                              <p className="text-xs text-muted-foreground">Check-in: {trip.hotel.checkIn} | Check-out: {trip.hotel.checkOut}</p>
                              {trip.hotel.preferences && <p className="text-xs text-muted-foreground">{trip.hotel.preferences}</p>}
                            </div>
                            <Badge variant="outline" className="text-[10px] border-primary/20 text-primary shrink-0">Hotel</Badge>
                          </div>
                        </div>
                      )}

                      {/* Mobility */}
                      {trip.mobility.length > 0 && (
                        <div className="px-5 pb-4 space-y-2">
                          {trip.mobility.map((leg, j) => (
                            <div key={j} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Car className="w-4 h-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{leg.leg}</p>
                                <p className="text-xs text-muted-foreground">{leg.time} — {leg.type}</p>
                              </div>
                              <Badge variant="outline" className="text-[10px] border-primary/20 text-primary shrink-0">Mobilidade</Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Conflicts */}
                      {trip.conflicts.length > 0 && (
                        <div className="px-5 pb-4">
                          <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/10">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                              <span className="text-xs font-semibold text-amber-400">
                                {trip.conflicts.length} conflito{trip.conflicts.length > 1 ? "s" : ""} detectado{trip.conflicts.length > 1 ? "s" : ""}
                              </span>
                            </div>
                            {trip.conflicts.map((conflict, j) => (
                              <div key={j} className="mb-2 last:mb-0">
                                <p className="text-sm font-medium">{conflict.event}</p>
                                <p className="text-xs text-muted-foreground">{conflict.originalTime} — {conflict.conflictReason}</p>
                                <p className="text-sm text-amber-400 mt-1">{conflict.suggestion}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bleisure */}
                      {trip.bleisure?.eligible && (
                        <div className="px-5 pb-4">
                          <div className="p-4 rounded-xl gradient-onhappy-soft border border-onhappy/20">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Sparkles className="w-5 h-5 text-secondary shrink-0" />
                                <div>
                                  <p className="text-sm font-medium">Bleisure disponível</p>
                                  <p className="text-xs text-muted-foreground">{trip.bleisure.reason}</p>
                                </div>
                              </div>
                              {isSafeUrl(trip.bleisure.onhappyLink) && (
                                <Button variant="onhappy" size="sm" asChild>
                                  <a href={trip.bleisure.onhappyLink} target="_blank" rel="noopener noreferrer">
                                    Ver tarifas<ExternalLink className="w-3 h-3 ml-1.5" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="px-5 pb-5 flex items-center gap-3">
                        {isBooked ? (
                          <Button size="sm" disabled className="opacity-80 bg-emerald-500/15 text-emerald-500 border-0 rounded-xl text-xs h-9 px-5">
                            <Check className="w-3.5 h-3.5 mr-1.5" />Agenda travada
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => bookCalendarEvents(trip, i)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 rounded-xl text-xs h-9 px-5 transition-all hover:-translate-y-0.5"
                          >
                            <Check className="w-3.5 h-3.5 mr-1.5" />Confirmar itinerário
                          </Button>
                        )}
                        {bookingLink && (
                          <Button variant="outline" size="sm" asChild className="rounded-xl text-xs h-9">
                            <a href={bookingLink} target="_blank" rel="noopener noreferrer">
                              Reservar na Onfly<ExternalLink className="w-3 h-3 ml-1.5" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="mt-8 p-6 rounded-2xl border border-dashed border-border text-center">
            <RefreshCw className="w-6 h-6 text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">Novos eventos aparecem após a sincronização</p>
            <p className="text-xs text-muted-foreground">Sincronize sua agenda para detectar compromissos que precisam de viagem</p>
          </div>
        </div>
      )}
    </div>
  );
}
