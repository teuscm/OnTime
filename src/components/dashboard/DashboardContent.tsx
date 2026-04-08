"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
} from "lucide-react";
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

  const scanCalendar = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar/events");
      if (!res.ok) throw new Error("Erro ao buscar eventos");
      const data = await res.json();
      setEvents(data.data);

      // Filter travel events via AI
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
        // Fallback: show events with locations
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
      if (!res.ok) {
        throw new Error("Erro ao criar eventos na agenda");
      }
      setBookedTrips((prev) => new Set(prev).add(tripIndex));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao travar agenda");
    }
  };

  // Build Onfly deep link from transport data
  const getOnflyBookingLink = (trip: TripItinerary): string | null => {
    if (!trip.transport) return null;
    const { outbound } = trip.transport;
    // Deep link with origin/destination codes — will redirect to Onfly search
    const params = new URLSearchParams({
      type: "flights",
      outboundDate: outbound.suggestedDate,
    });
    return `https://app.onfly.com/travel/#/travel/booking/search?${params.toString()}`;
  };

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          Ola, {userName.split(" ")[0]}
        </h1>
        <p className="text-muted mt-1">
          {step === "connect" && "Conecte sua agenda para comecar."}
          {step === "scan" && "Vamos escanear sua agenda dos proximos 30 dias."}
          {step === "select" && `${travelEvents.length} viagens detectadas. Selecione quais planejar.`}
          {step === "itinerary" && "Seu itinerario esta pronto."}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Step: Connect Calendar */}
      {step === "connect" && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-onfly" />
              Conectar Agenda
            </CardTitle>
            <CardDescription>
              Conecte seu Google Calendar para que possamos detectar viagens automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/api/auth/google">
                Conectar Google Calendar
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <div className="mt-4 rounded-lg border border-border p-4 opacity-50">
              <p className="text-sm text-muted">Microsoft Outlook — em breve</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Scan */}
      {step === "scan" && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              Google Calendar conectado
            </CardTitle>
            <CardDescription>
              Pronto para escanear seus eventos dos proximos 30 dias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={scanCalendar} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Escaneando...
                </>
              ) : (
                <>
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
                <MapPin className="h-12 w-12 text-subtle mx-auto mb-4" />
                <h3 className="text-lg font-medium">Nenhuma viagem detectada</h3>
                <p className="text-muted mt-2">
                  Nao encontramos eventos nos proximos 30 dias que exijam deslocamento.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {travelEvents.map((event) => (
                <label
                  key={event.id}
                  className={`glow-card p-4 flex items-start gap-4 cursor-pointer transition-all ${
                    selectedEventIds.has(event.id) ? "border-onfly/40" : "opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedEventIds.has(event.id)}
                    onChange={() => toggleEvent(event.id)}
                    className="mt-1 h-4 w-4 rounded border-border accent-onfly"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{event.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(event.start).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              ))}

              <Button
                onClick={generateItinerary}
                disabled={loading || selectedEventIds.size === 0}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando itinerario...
                  </>
                ) : (
                  <>
                    Gerar Itinerario ({selectedEventIds.size} viagens)
                    <ArrowRight className="h-5 w-5" />
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
          {itinerary.trips.map((trip, i) => {
            const isBooked = bookedTrips.has(i);
            const bookingLink = getOnflyBookingLink(trip);

            return (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="border-b border-border pb-4">
                  <CardTitle>{trip.event.title}</CardTitle>
                  <CardDescription className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {trip.event.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(trip.event.datetime).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Transport */}
                  {trip.transport && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Plane className="h-4 w-4 text-onfly" />
                        Transporte
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-xs text-muted mb-1">Ida</p>
                          <p className="font-medium">
                            {trip.transport.outbound.origin} → {trip.transport.outbound.destination}
                          </p>
                          <p className="text-sm text-muted">
                            {trip.transport.outbound.suggestedDate} as {trip.transport.outbound.suggestedTime}
                          </p>
                          <p className="text-xs text-subtle mt-1">{trip.transport.outbound.reason}</p>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-xs text-muted mb-1">Volta</p>
                          <p className="font-medium">
                            {trip.transport.return.origin} → {trip.transport.return.destination}
                          </p>
                          <p className="text-sm text-muted">
                            {trip.transport.return.suggestedDate} as {trip.transport.return.suggestedTime}
                          </p>
                          <p className="text-xs text-subtle mt-1">{trip.transport.return.reason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hotel */}
                  {trip.hotel?.needed && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Hotel className="h-4 w-4 text-onfly" />
                        Hospedagem
                      </h4>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-sm">
                          Check-in: {trip.hotel.checkIn} | Check-out: {trip.hotel.checkOut}
                        </p>
                        {trip.hotel.preferences && (
                          <p className="text-xs text-muted mt-1">{trip.hotel.preferences}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mobility */}
                  {trip.mobility.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Car className="h-4 w-4 text-onfly" />
                        Mobilidade
                      </h4>
                      <div className="space-y-2">
                        {trip.mobility.map((leg, j) => (
                          <div key={j} className="flex items-center justify-between rounded-lg border border-border p-3">
                            <span className="text-sm">{leg.leg}</span>
                            <span className="text-xs text-muted">{leg.time} — {leg.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conflicts */}
                  {trip.conflicts.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2 text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                        Conflitos
                      </h4>
                      {trip.conflicts.map((conflict, j) => (
                        <div key={j} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                          <p className="text-sm font-medium">{conflict.event}</p>
                          <p className="text-xs text-muted mt-1">
                            {conflict.originalTime} — {conflict.conflictReason}
                          </p>
                          <p className="text-sm text-amber-400 mt-2">{conflict.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bleisure */}
                  {trip.bleisure?.eligible && (
                    <div className="rounded-lg gradient-onhappy-soft border border-onhappy/20 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-onhappy" />
                        <span className="text-sm font-medium">Oportunidade Bleisure</span>
                      </div>
                      <p className="text-sm text-muted mb-3">{trip.bleisure.reason}</p>
                      {isSafeUrl(trip.bleisure.onhappyLink) && (
                        <Button variant="onhappy" size="sm" asChild>
                          <a href={trip.bleisure.onhappyLink} target="_blank" rel="noopener noreferrer">
                            Ver no OnHappy
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4 border-t border-border">
                    {isBooked ? (
                      <Button size="sm" disabled className="opacity-80">
                        <Check className="h-4 w-4" />
                        Agenda travada
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => bookCalendarEvents(trip, i)}
                      >
                        Confirmar e travar agenda
                      </Button>
                    )}
                    {bookingLink && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={bookingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Reservar na Onfly
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
