"use client";

import { useState, useEffect, useCallback } from "react";
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
import { resolveDestinationCode } from "@/lib/cities";
import { buildScenarioDates } from "@/lib/travel-dates";
import type { CalendarEvent, ItineraryResponse, TripItinerary, EnrichedTripItinerary, FlightOption, HotelOption } from "@/types";

interface SearchStep {
  label: string;
  status: "pending" | "loading" | "done" | "error";
  detail?: string;
  price?: number;
}

interface FlightScenarioResult {
  label: string;
  dep: string;
  ret: string;
  quoteId: string;
  checkoutLink: string;
  cheapestTotal: number;
  outbound: FlightOption[];
  inbound: FlightOption[];
  resolvedAirports: { origin: { city: { placeId: string } }; destination: { city: { placeId: string } } } | null;
}

interface HotelSearchResult {
  quoteId: string;
  hotelQuoteId?: string;
  checkoutLink: string;
  recommended: HotelOption[];
  nearPoi: HotelOption[];
  // Backward compat getter
  options?: HotelOption[];
}

interface DashboardContentProps {
  hasGoogleCalendar: boolean;
  userName: string;
  homeAirport: string;
  itineraryStyle: string;
  bufferArriveDayBefore: boolean;
  bufferDepartDayAfter: boolean;
  bleisureEnabled: boolean;
  hotelMaxDailyPrice: number;
  hotelMaxDistance: number;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function DashboardContent({ hasGoogleCalendar, userName, homeAirport, itineraryStyle, bufferArriveDayBefore, bufferDepartDayAfter, bleisureEnabled, hotelMaxDailyPrice, hotelMaxDistance }: DashboardContentProps) {
  const [step, setStep] = useState<"connect" | "scan" | "select" | "searching" | "compare" | "itinerary">(
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
  const [enrichedTrips, setEnrichedTrips] = useState<EnrichedTripItinerary[] | null>(null);
  const [searchSteps, setSearchSteps] = useState<SearchStep[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [flightResults, setFlightResults] = useState<FlightScenarioResult[]>([]);
  const [hotelResult, setHotelResult] = useState<HotelSearchResult | null>(null);

  const updateStep = (label: string, update: Partial<SearchStep>) => {
    setSearchSteps((prev) => prev.map((s) => s.label === label ? { ...s, ...update } : s));
  };
  const addStep = (step: SearchStep) => {
    setSearchSteps((prev) => [...prev, step]);
  };

  // Navigation guard — prevent leaving during search or with draft itinerary
  const shouldGuard = isWorking || (step === "itinerary" && !bookedTrips.size);

  useEffect(() => {
    if (!shouldGuard) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldGuard]);

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
        setSelectedEventIds(new Set()); // User picks which to plan
      } else {
        const withLocation = data.data.filter((e: CalendarEvent) => e.location);
        setTravelEvents(withLocation);
        setSelectedEventIds(new Set()); // User picks which to plan
      }
      setStep("select");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  // Stored between search and Claude call
  const [searchedEvent, setSearchedEvent] = useState<CalendarEvent | null>(null);
  const [destCode, setDestCode] = useState<string>("");

  // PHASE 1: Search flights + hotels, then show comparison
  const generateItinerary = async () => {
    setError(null);
    setSearchSteps([]);
    setFlightResults([]);
    setHotelResult(null);
    setIsWorking(true);

    const selected = travelEvents.filter((e) => selectedEventIds.has(e.id));
    const event = selected[0];
    if (!event) return;
    setSearchedEvent(event);

    setStep("searching");

    try {
      const dest = resolveDestinationCode(event.location ?? "");
      if (!dest) throw new Error(`Não foi possível identificar o destino de "${event.location}"`);
      setDestCode(dest);

      const scenarios = buildScenarioDates(event.start, event.end, { itineraryStyle, bufferArriveDayBefore, bufferDepartDayAfter, bleisureEnabled });

      // Search flights + hotel ALL in parallel
      const flightSteps = scenarios.map((s) => ({ label: `${s.label} ${homeAirport}→${dest}`, status: "loading" as const }));
      setSearchSteps([...flightSteps]);

      const allResults: FlightScenarioResult[] = [];

      // Hotel search — 3 separate requests, runs in parallel with flights
      const bufferScenario = scenarios.find((s) => s.label === "Com buffer") ?? scenarios[0];
      const locationShort = event.location?.split(",")[0] ?? dest;
      const hotelQuoteLabel = `Cotando hotéis em ${locationShort}`;
      const hotelRecLabel = `Hotéis recomendados`;
      const hotelNearLabel = `Hotéis perto de ${locationShort}`;

      const hotelPromise = (async () => {
        // Request 1: Create quote (resolve POI + quote)
        setSearchSteps((prev) => [...prev, { label: hotelQuoteLabel, status: "loading" }]);
        let quoteId = "";
        let hotelQuoteId = "";
        try {
          const res = await fetch("/api/onfly/hotel-quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ location: event.location ?? "", checkIn: bufferScenario.dep, checkOut: bufferScenario.ret }),
          });
          if (!res.ok) throw new Error("Falha ao criar quote");
          const data = (await res.json()).data;
          quoteId = data.quoteId;
          hotelQuoteId = data.hotelQuoteId;
          updateStep(hotelQuoteLabel, { status: "done", detail: `${data.initialCount} hotéis encontrados` });
        } catch {
          updateStep(hotelQuoteLabel, { status: "error", detail: "Falha" });
          return;
        }

        // Request 2 + 3: Filtered searches in parallel
        setSearchSteps((prev) => [...prev, { label: hotelRecLabel, status: "loading" }, { label: hotelNearLabel, status: "loading" }]);

        const filterParams = new URLSearchParams({
          quote_id: quoteId,
          hotel_quote_id: hotelQuoteId,
          check_in: bufferScenario.dep,
          check_out: bufferScenario.ret,
          max_distance: String(hotelMaxDistance),
          min_price: "6500",
          max_price: String(hotelMaxDailyPrice),
        });

        const [recRes, nearRes] = await Promise.all([
          fetch(`/api/onfly/hotel-filter?${filterParams}&sort=recommended`).then(async (r) => {
            if (!r.ok) throw new Error("Falha");
            const d = (await r.json()).data;
            updateStep(hotelRecLabel, { status: "done", detail: `${d.options.length} hotéis` });
            return d;
          }).catch(() => { updateStep(hotelRecLabel, { status: "error", detail: "Falha" }); return null; }),

          fetch(`/api/onfly/hotel-filter?${filterParams}&sort=distanceToPoi`).then(async (r) => {
            if (!r.ok) throw new Error("Falha");
            const d = (await r.json()).data;
            updateStep(hotelNearLabel, { status: "done", detail: `${d.options.length} hotéis` });
            return d;
          }).catch(() => { updateStep(hotelNearLabel, { status: "error", detail: "Falha" }); return null; }),
        ]);

        setHotelResult({
          quoteId,
          hotelQuoteId,
          checkoutLink: recRes?.checkoutLink ?? nearRes?.checkoutLink ?? "",
          recommended: recRes?.options ?? [],
          nearPoi: nearRes?.options ?? [],
        });
      })();

      // Flight searches
      const flightPromises = scenarios.map(async (scenario, idx) => {
        try {
          const params = new URLSearchParams({ from: homeAirport, to: dest, departure_date: scenario.dep, return_date: scenario.ret });
          const res = await fetch(`/api/onfly/search-flights?${params}`);
          if (!res.ok) throw new Error(`${res.status}`);
          const d = (await res.json()).data;
          allResults[idx] = { ...scenario, quoteId: d.quoteId, checkoutLink: d.checkoutLink, cheapestTotal: d.cheapestTotal, outbound: d.outbound, inbound: d.inbound, resolvedAirports: d.resolvedAirports };
          setFlightResults([...allResults]);
          updateStep(flightSteps[idx].label, { status: "done", detail: `${d.outbound.length + d.inbound.length} voos`, price: d.cheapestTotal });
        } catch {
          updateStep(flightSteps[idx].label, { status: "error", detail: "Falha" });
        }
      });

      // Wait for ALL (flights + hotel) in parallel
      await Promise.all([...flightPromises, hotelPromise]);

      // Go to comparison view
      setStep("compare");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("select");
    } finally {
      setIsWorking(false);
    }
  };

  // PHASE 2: User picks a scenario → call Claude
  const selectScenario = async (scenarioIndex: number) => {
    setIsWorking(true);
    setError(null);
    setStep("searching");
    setSearchSteps([{ label: "Analisando com IA", status: "loading" }]);

    const selected = travelEvents.filter((e) => selectedEventIds.has(e.id));
    const chosenScenario = flightResults[scenarioIndex];
    if (!chosenScenario || !searchedEvent) return;

    try {
      const onflyDataForClaude = [{
        eventId: searchedEvent.id,
        eventTitle: searchedEvent.title,
        flightScenarios: [{ // Only the chosen scenario
          label: chosenScenario.label,
          dates: `${chosenScenario.dep} → ${chosenScenario.ret}`,
          cheapestPrice: chosenScenario.cheapestTotal,
          outbound: [...chosenScenario.outbound].sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0)).slice(0, 5).map((f) => ({ id: f.id, cia: f.airline.code, route: `${f.from}→${f.to}`, dep: f.departure.slice(11, 16), dur: f.duration, stops: f.stops, price: f.totalPrice, rec: f.recommended || undefined })),
          inbound: [...chosenScenario.inbound].sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0)).slice(0, 5).map((f) => ({ id: f.id, cia: f.airline.code, route: `${f.from}→${f.to}`, dep: f.departure.slice(11, 16), dur: f.duration, stops: f.stops, price: f.totalPrice, rec: f.recommended || undefined })),
        }],
        hotels: (hotelResult?.recommended ?? []).sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0)).slice(0, 10).map((h) => ({ id: h.id, name: h.name, stars: h.stars, price: h.pricePerNight, cafe: h.breakfast || undefined, rec: h.recommended || undefined })),
      }];

      const res = await fetch("/api/itinerary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ travelEvents: selected, allEvents: events, onflyData: onflyDataForClaude }),
      });
      if (!res.ok) throw new Error("Erro ao gerar itinerário");
      const data = await res.json();
      setItinerary(data.data);

      // Build enriched trip
      // Ensure exactly 1 recommended per direction
      const ensureSingleRec = (opts: FlightOption[]): FlightOption[] => {
        let found = false;
        return opts.map((f) => {
          if (f.recommended && !found) { found = true; return f; }
          return { ...f, recommended: false };
        });
      };

      const fallbackAirport = { id: "", code: "", name: "", placeId: "", city: { name: "", stateCode: "", countryCode: "BR", placeId: "" } };
      setEnrichedTrips([{
        ...(data.data.trips?.[0] ?? {}),
        flightOutbound: chosenScenario.outbound.length > 0 ? {
          origin: chosenScenario.resolvedAirports?.origin ?? { ...fallbackAirport, code: homeAirport },
          destination: chosenScenario.resolvedAirports?.destination ?? { ...fallbackAirport, code: destCode },
          options: ensureSingleRec(chosenScenario.outbound),
          quoteId: chosenScenario.quoteId,
          checkoutLink: chosenScenario.checkoutLink,
        } : null,
        flightReturn: chosenScenario.inbound.length > 0 ? {
          origin: chosenScenario.resolvedAirports?.destination ?? { ...fallbackAirport, code: destCode },
          destination: chosenScenario.resolvedAirports?.origin ?? { ...fallbackAirport, code: homeAirport },
          options: ensureSingleRec(chosenScenario.inbound),
          quoteId: chosenScenario.quoteId,
          checkoutLink: chosenScenario.checkoutLink,
        } : null,
        hotelResults: hotelResult ?? null,
      } as EnrichedTripItinerary]);

      updateStep("Analisando com IA", { status: "done", detail: "Pronto" });
      setStep("itinerary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("compare");
    } finally {
      setIsWorking(false);
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
      const enriched = enrichedTrips?.[tripIndex];
      const events: Array<{ title: string; start: string; end: string; description?: string; location?: string }> = [];
      const desc = "Criado pelo OnTime | Onfly";
      // Onfly returns "2026-04-22 08:05:00" — Google needs "2026-04-22T08:05:00"
      const toISO = (dt: string) => {
        if (!dt) return "";
        return dt.includes("T") ? dt.split(".")[0] : dt.replace(" ", "T");
      };
      // Add minutes to datetime string, return clean ISO without Z or ms
      const addMin = (iso: string, min: number) => {
        const clean = toISO(iso);
        const d = new Date(clean);
        d.setMinutes(d.getMinutes() + min);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
      };

      const recOut = enriched?.flightOutbound?.options.find((f) => f.recommended);
      const recRet = enriched?.flightReturn?.options.find((f) => f.recommended);
      const recHotel = enriched?.hotelResults?.recommended?.find((h) => h.recommended) ?? enriched?.hotelResults?.recommended?.[0];
      const eventLocation = trip.event.location ?? "";

      if (recOut) {
        const outDep = toISO(recOut.departure);

        // 1. Casa → Aeroporto origem (2h antes do voo)
        const casaToAirport = addMin(outDep, -120);
        events.push({ title: `🚗 Casa → Aeroporto ${recOut.from}`, start: casaToAirport, end: addMin(casaToAirport, 60), description: `uber | ${desc}` });

        // 2. Voo de ida
        events.push({ title: `✈️ ${recOut.airline.code} ${recOut.flightNumber} ${recOut.from}→${recOut.to}`, start: outDep, end: toISO(recOut.arrival), description: `${recOut.airline.name} | R$ ${recOut.totalPrice.toFixed(2)} | ${desc}` });

        const outArr = toISO(recOut.arrival);

        if (recHotel && trip.hotel?.needed) {
          // 3. Aeroporto destino → Hotel
          events.push({ title: `🚗 Aeroporto ${recOut.to} → ${recHotel.name}`, start: addMin(outArr, 30), end: addMin(outArr, 90), description: `uber | ${desc}`, location: recHotel.neighborhood });

          // 4. Hotel check-in/out
          events.push({ title: `🏨 ${recHotel.name}`, start: `${trip.hotel.checkIn}T15:00:00`, end: `${trip.hotel.checkOut}T11:00:00`, description: `${recHotel.stars}★ | R$ ${recHotel.pricePerNight.toFixed(2)}/noite | ${recHotel.breakfast ? "Café incluso" : ""} | ${desc}`, location: recHotel.neighborhood });

          // 5. Hotel → Evento (no dia do evento, 1h antes)
          const eventStart = trip.event.datetime.includes("T") ? trip.event.datetime : `${trip.event.datetime}`;
          events.push({ title: `🚗 ${recHotel.name} → ${eventLocation.split(",")[0]}`, start: addMin(eventStart, -60), end: eventStart, description: `uber | ${desc}` });

          // 6. Evento → Hotel (após evento)
          const eventEnd = addMin(eventStart, (trip.event.durationHours ?? 2) * 60);
          events.push({ title: `🚗 ${eventLocation.split(",")[0]} → ${recHotel.name}`, start: eventEnd, end: addMin(eventEnd, 30), description: `uber | ${desc}` });
        } else {
          // Bate-volta: aeroporto → evento
          events.push({ title: `🚗 Aeroporto ${recOut.to} → ${eventLocation.split(",")[0]}`, start: addMin(outArr, 30), end: addMin(outArr, 60), description: `uber | ${desc}` });
        }
      }

      if (recRet) {
        const retDep = toISO(recRet.departure);

        if (recHotel && trip.hotel?.needed) {
          // 7. Hotel → Aeroporto volta (2h antes do voo de volta)
          events.push({ title: `🚗 ${recHotel.name} → Aeroporto ${recRet.from}`, start: addMin(retDep, -120), end: addMin(retDep, -60), description: `uber | ${desc}` });
        } else {
          // Bate-volta: evento → aeroporto
          events.push({ title: `🚗 ${eventLocation.split(",")[0]} → Aeroporto ${recRet.from}`, start: addMin(retDep, -90), end: addMin(retDep, -30), description: `uber | ${desc}` });
        }

        // 8. Voo de volta
        events.push({ title: `✈️ ${recRet.airline.code} ${recRet.flightNumber} ${recRet.from}→${recRet.to}`, start: retDep, end: toISO(recRet.arrival), description: `${recRet.airline.name} | R$ ${recRet.totalPrice.toFixed(2)} | ${desc}` });

        // 9. Aeroporto origem → Casa
        const retArr = toISO(recRet.arrival);
        events.push({ title: `🚗 Aeroporto ${recRet.to} → Casa`, start: addMin(retArr, 30), end: addMin(retArr, 90), description: `uber | ${desc}` });
      }

      if (events.length === 0) {
        throw new Error("Nenhum evento para criar");
      }

      const res = await fetch("/api/calendar/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
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
            <>O OnTime está pronto para escanear sua agenda dos próximos <span className="text-primary font-medium">60 dias</span>.</>
          )}
          {step === "select" && (
            <>O OnTime encontrou <span className="text-primary font-medium">{travelEvents.length} eventos</span> que podem precisar de viagem. Selecione quais planejar.</>
          )}
          {step === "searching" && "Buscando as melhores opções para você..."}
          {step === "compare" && "Compare as opções e escolha seu itinerário."}
          {step === "itinerary" && "Seu itinerário está pronto."}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      {/* Stats grid (visible after scan) */}
      {(step === "select" || step === "searching" || step === "compare" || step === "itinerary") && (
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
                <p className="text-sm text-muted-foreground">Pronto para escanear seus eventos dos próximos 60 dias.</p>
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
                <p className="text-muted-foreground mt-2">Não encontramos eventos nos próximos 60 dias que exijam deslocamento.</p>
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
                  <div
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleEvent(event.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleEvent(event.id); } }}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left cursor-pointer",
                      selectedEventIds.has(event.id)
                        ? "border-primary/50 bg-primary/[0.06]"
                        : "border-border/50 bg-card hover:border-border"
                    )}
                  >
                    <Checkbox
                      checked={selectedEventIds.has(event.id)}
                      onCheckedChange={() => toggleEvent(event.id)}
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
                  </div>
                ))}
              </div>

              <Button
                onClick={generateItinerary}
                disabled={loading || selectedEventIds.size === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 rounded-xl text-sm h-10 px-6 transition-all hover:-translate-y-0.5"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Preparando...</>
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

      {/* Step: Searching — streaming progress */}
      {step === "searching" && (
        <div className="max-w-lg mx-auto space-y-6 py-8">
          {/* Selected events summary */}
          <div className="space-y-2">
            {travelEvents
              .filter((e) => selectedEventIds.has(e.id))
              .map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/[0.04] animate-fade-in"
                >
                  <Plane className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.start).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                  </div>
                  <Check className="w-4 h-4 text-primary shrink-0" />
                </div>
              ))}
          </div>

          {/* Search steps with live status */}
          <div className="space-y-2">
            {searchSteps.map((s, i) => (
              <div
                key={i}
                className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all duration-300", s.status === "done" ? "border-emerald-500/20 bg-emerald-500/[0.04]" : s.status === "loading" ? "border-primary/20 bg-primary/[0.04]" : s.status === "error" ? "border-destructive/20 bg-destructive/[0.04]" : "border-border/50 bg-card/50 opacity-50")}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {s.status === "loading" && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />}
                {s.status === "done" && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                {s.status === "error" && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
                {s.status === "pending" && <div className="w-4 h-4 rounded-full border border-border shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.label}</p>
                  {s.detail && <p className="text-xs text-muted-foreground">{s.detail}</p>}
                </div>
                {s.price != null && s.status === "done" && (
                  <span className="text-sm font-semibold text-emerald-500 shrink-0">R$ {s.price.toFixed(2).replace(".", ",")}</span>
                )}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full gradient-onfly transition-all duration-1000 ease-out"
              style={{ width: isWorking ? "85%" : "100%", animation: isWorking ? "progress 30s ease-out forwards" : undefined }}
            />
          </div>
        </div>
      )}

      {/* Step: Compare scenarios */}
      {step === "compare" && flightResults.length > 0 && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flightResults.filter(Boolean).filter((r) => r.label === "Bate-volta" || r.label === "Com buffer").map((scenario, idx) => {
              const recOutbound = scenario.outbound.find((f) => f.recommended) ?? scenario.outbound[0];
              const recInbound = scenario.inbound.find((f) => f.recommended) ?? scenario.inbound[0];
              const recHotel = scenario.label !== "Bate-volta" ? (hotelResult?.recommended.find((h) => h.recommended) ?? hotelResult?.recommended[0]) : null;
              const nights = recHotel && scenario.label !== "Bate-volta" ? Math.max(1, Math.round((new Date(scenario.ret).getTime() - new Date(scenario.dep).getTime()) / 86400000)) : 0;
              const hotelTotal = recHotel ? recHotel.pricePerNight * nights : 0;
              const flightTotal = scenario.cheapestTotal;
              const total = flightTotal + hotelTotal;
              const isCheapest = flightResults.filter(Boolean).filter((r) => r.label === "Bate-volta" || r.label === "Com buffer").every((other) => {
                const otherHotel = other.label !== "Bate-volta" && hotelResult?.recommended?.[0] ? hotelResult.recommended[0].pricePerNight * Math.max(1, Math.round((new Date(other.ret).getTime() - new Date(other.dep).getTime()) / 86400000)) : 0;
                return total <= other.cheapestTotal + otherHotel;
              });

              return (
                <Card key={scenario.label} className={cn("border-border/50 transition-all hover:border-primary/30", isCheapest && "border-primary/40 shadow-[0_0_20px_rgba(0,158,251,0.08)]")}>
                  <CardContent className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{scenario.label}</h3>
                          {isCheapest && <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-0">Melhor custo</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{scenario.dep} → {scenario.ret}</p>
                      </div>
                    </div>

                    {/* Outbound flight */}
                    {recOutbound && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 text-xs">
                        <div className="flex items-center gap-2">
                          <Plane className="w-3.5 h-3.5 text-primary" />
                          <span className="font-mono font-semibold bg-card px-1.5 py-0.5 rounded">{recOutbound.airline.code}</span>
                          <span className="text-muted-foreground">{recOutbound.from}→{recOutbound.to}</span>
                          <span className="text-muted-foreground">{recOutbound.stops === 0 ? "Direto" : `${recOutbound.stops}p`}</span>
                          <span className="text-muted-foreground">{recOutbound.duration}min</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">Ida</Badge>
                      </div>
                    )}

                    {/* Return flight */}
                    {recInbound && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 text-xs">
                        <div className="flex items-center gap-2">
                          <Plane className="w-3.5 h-3.5 text-primary" />
                          <span className="font-mono font-semibold bg-card px-1.5 py-0.5 rounded">{recInbound.airline.code}</span>
                          <span className="text-muted-foreground">{recInbound.from}→{recInbound.to}</span>
                          <span className="text-muted-foreground">{recInbound.stops === 0 ? "Direto" : `${recInbound.stops}p`}</span>
                          <span className="text-muted-foreground">{recInbound.duration}min</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">Volta</Badge>
                      </div>
                    )}

                    {/* Hotel */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 text-xs">
                      <div className="flex items-center gap-2">
                        <Hotel className="w-3.5 h-3.5 text-primary" />
                        {recHotel ? (
                          <>
                            <span className="font-medium truncate max-w-[160px]">{recHotel.name}</span>
                            <span className="text-muted-foreground">{"★".repeat(recHotel.stars)}</span>
                            {recHotel.breakfast && <span className="text-emerald-400">Cafe</span>}
                          </>
                        ) : scenario.label === "Bate-volta" ? (
                          <span className="text-muted-foreground">Sem hotel (mesmo dia)</span>
                        ) : !hotelResult ? (
                          <span className="text-muted-foreground animate-pulse">Buscando hotéis...</span>
                        ) : (
                          <span className="text-muted-foreground">Nenhum hotel encontrado nos filtros</span>
                        )}
                      </div>
                      {recHotel && <span className="text-muted-foreground">R$ {recHotel.pricePerNight.toFixed(2).replace(".", ",")} × {nights}n</span>}
                    </div>

                    {/* Divider + Total */}
                    <div className="border-t border-border/50 pt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Total estimado</span>
                      {scenario.label !== "Bate-volta" && !hotelResult ? (
                        <span className="text-sm text-muted-foreground animate-pulse">Calculando...</span>
                      ) : (
                        <span className="text-lg font-bold tracking-tight">R$ {total.toFixed(2).replace(".", ",")}</span>
                      )}
                    </div>

                    {/* CTA */}
                    <Button
                      onClick={() => selectScenario(flightResults.indexOf(scenario))}
                      disabled={isWorking}
                      className={cn("w-full", isCheapest ? "bg-primary hover:bg-primary/90" : "bg-muted hover:bg-muted/80 text-foreground")}
                    >
                      {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Escolher este itinerário"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Bleisure banner */}
          {bleisureEnabled && flightResults.find((r) => r?.label?.includes("Bleisure")) && (() => {
            const bleisure = flightResults.find((r) => r?.label?.includes("Bleisure"));
            const buffer = flightResults.find((r) => r?.label === "Com buffer");
            const savings = buffer && bleisure ? buffer.cheapestTotal - bleisure.cheapestTotal : 0;
            if (savings <= 0 || !bleisure) return null;
            return (
              <div className="p-4 rounded-xl gradient-onhappy-soft border border-onhappy/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-secondary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Volte no domingo ({bleisure.ret}) e economize R$ {savings.toFixed(2).replace(".", ",")}</p>
                    <p className="text-xs text-muted-foreground">OnHappy cobre a hospedagem do fim de semana</p>
                  </div>
                </div>
              </div>
            );
          })()}
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
                    {/* Route display — use real airport from recommended flight */}
                    {trip.transport && (() => {
                      const recOut = enrichedTrips?.[i]?.flightOutbound?.options.find((f) => f.recommended);
                      const displayFrom = recOut?.from ?? trip.transport.outbound.origin;
                      const displayTo = recOut?.to ?? trip.transport.outbound.destination;
                      return (
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Origem</p>
                            <p className="text-lg font-bold">{displayFrom}</p>
                          </div>
                          <div className="flex-1 flex items-center justify-center px-4">
                            <div className="w-full h-px bg-border relative">
                              <Plane className="w-4 h-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-0.5" />
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground mb-1">Destino</p>
                            <p className="text-lg font-bold">{displayTo}</p>
                          </div>
                        </div>
                      );
                    })()}

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

                    {/* AI recommendation reason */}
                    {trip.recommendationReason && (
                      <div className="mt-3 p-3 rounded-lg bg-primary/[0.04] border border-primary/10">
                        <p className="text-xs text-muted-foreground leading-relaxed">{trip.recommendationReason}</p>
                      </div>
                    )}
                  </button>

                  {expanded && (
                    <div className="border-t border-border/50 animate-fade-in">
                      {/* Transport legs */}
                      {trip.transport && (
                        <div className="p-5 space-y-2">
                          {[
                            { label: `${trip.transport.outbound.origin} → ${trip.transport.outbound.destination}`, time: `${trip.transport.outbound.suggestedDate} às ${trip.transport.outbound.suggestedTime}`, icon: Plane, tag: "Ida", detail: trip.transport.outbound.reason, enrichment: enrichedTrips?.[i]?.flightOutbound },
                            { label: `${trip.transport.return.origin} → ${trip.transport.return.destination}`, time: `${trip.transport.return.suggestedDate} às ${trip.transport.return.suggestedTime}`, icon: Plane, tag: "Volta", detail: trip.transport.return.reason, enrichment: enrichedTrips?.[i]?.flightReturn },
                          ].map((leg, j) => (
                            <div key={j} className="space-y-1.5">
                              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
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
                              {/* Enriched flight options */}
                              {leg.enrichment && leg.enrichment.options.length > 0 && (
                                <div className="ml-11 space-y-1">
                                  {[...leg.enrichment.options].sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0)).slice(0, 3).map((flight) => (
                                    <div key={flight.id} className={cn("flex items-center justify-between p-2 rounded-lg text-xs", flight.recommended ? "bg-primary/10 border border-primary/20" : "bg-muted/30")}>
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-semibold text-[11px] bg-card px-1.5 py-0.5 rounded">{flight.airline.code}</span>
                                        <span className="text-muted-foreground">{flight.from}→{flight.to}</span>
                                        <span className="text-muted-foreground">{flight.stops === 0 ? "Direto" : `${flight.stops}p`}</span>
                                        <span className="text-muted-foreground">{flight.duration}min</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {flight.recommended && <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-0">IA</Badge>}
                                        <span className="font-semibold">R$ {flight.totalPrice.toFixed(2).replace(".", ",")}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Hotel */}
                      {trip.hotel?.needed && (
                        <div className="px-5 pb-4 space-y-1.5">
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
                          {/* Enriched hotel options */}
                          {enrichedTrips?.[i]?.hotelResults && (enrichedTrips[i].hotelResults!.recommended?.length > 0 || enrichedTrips[i].hotelResults!.nearPoi?.length > 0) && (
                            <div className="ml-11 space-y-1">
                              {[...(enrichedTrips[i].hotelResults!.recommended ?? [])].sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0)).slice(0, 3).map((hotel) => (
                                <div key={hotel.id} className={cn("flex items-center justify-between p-2 rounded-lg text-xs", hotel.recommended ? "bg-primary/10 border border-primary/20" : "bg-muted/30")}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-medium truncate">{hotel.name}</span>
                                    <span className="text-muted-foreground shrink-0">{"★".repeat(hotel.stars)}</span>
                                    {hotel.breakfast && <span className="text-emerald-400 shrink-0">Cafe</span>}
                                    {hotel.agreement && <span className="text-primary shrink-0">Acordo</span>}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {hotel.recommended && <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-0">IA</Badge>}
                                    <span className="font-semibold">R$ {hotel.pricePerNight.toFixed(2).replace(".", ",")}/n</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
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
                        {/* Onfly checkout links */}
                        {enrichedTrips?.[i]?.flightOutbound?.checkoutLink && (
                          <Button size="sm" variant="outline" asChild className="rounded-xl text-xs h-9 px-4">
                            <a href={enrichedTrips[i].flightOutbound!.checkoutLink} target="_blank" rel="noopener noreferrer">
                              <Plane className="w-3.5 h-3.5 mr-1.5" />Carrinho voo
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          </Button>
                        )}
                        {enrichedTrips?.[i]?.hotelResults?.checkoutLink && (
                          <Button size="sm" variant="outline" asChild className="rounded-xl text-xs h-9 px-4">
                            <a href={enrichedTrips[i].hotelResults!.checkoutLink} target="_blank" rel="noopener noreferrer">
                              <Hotel className="w-3.5 h-3.5 mr-1.5" />Carrinho hotel
                              <ExternalLink className="w-3 h-3 ml-1" />
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
