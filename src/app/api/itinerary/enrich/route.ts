import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPreferences, dbRowToPreferences } from "@/lib/db";
import {
  getInternalBffToken,
  createAndSearchFlights,
  createAndSearchHotels,
  searchAirports,
} from "@/lib/onfly";
import type { OnflyAirport, FlightResult, HotelResult } from "@/lib/onfly";
import { pickRecommendedFlightId, pickRecommendedHotelId } from "@/lib/recommend";
import type {
  CalendarEvent,
  TripItinerary,
  EnrichedTripItinerary,
  FlightOption,
  HotelOption,
  FlightEnrichment,
  FlightScenario,
  HotelEnrichment,
  ResolvedAirport,
} from "@/types";

export const maxDuration = 60;

const CHECKOUT_BASE = "https://app.onfly.com/travel/#/travel/booking/checkout";

// Map city names found in event locations to Onfly city/airport codes
const CITY_TO_CODE: Record<string, string> = {
  "são paulo": "SAO", "sao paulo": "SAO", "sp": "SAO", "guarulhos": "GRU", "congonhas": "CGH",
  "rio de janeiro": "RIO", "rio": "RIO", "galeão": "GIG", "santos dumont": "SDU",
  "belo horizonte": "BHZ", "confins": "CNF", "pampulha": "PLU",
  "brasília": "BSB", "brasilia": "BSB",
  "recife": "REC", "salvador": "SSA", "fortaleza": "FOR",
  "curitiba": "CWB", "porto alegre": "POA", "florianópolis": "FLN", "florianopolis": "FLN",
  "campinas": "VCP", "goiânia": "GYN", "goiania": "GYN",
  "manaus": "MAO", "belém": "BEL", "belem": "BEL",
  "vitória": "VIX", "vitoria": "VIX", "natal": "NAT",
  "joão pessoa": "JPA", "joao pessoa": "JPA", "maceió": "MCZ", "maceio": "MCZ",
  "campo grande": "CGR", "cuiabá": "CGB", "cuiaba": "CGB",
};

function resolveDestinationCode(location: string): string | null {
  const lower = location.toLowerCase();
  for (const [city, code] of Object.entries(CITY_TO_CODE)) {
    if (lower.includes(city)) return code;
  }
  // Try if location itself looks like an IATA code (3 uppercase letters)
  const iataMatch = location.match(/\b([A-Z]{3})\b/);
  if (iataMatch) return iataMatch[1];
  return null;
}

function toResolvedAirport(a: OnflyAirport): ResolvedAirport {
  return { id: a.id, code: a.code, name: a.name, placeId: a.placeId, city: { name: a.city.name, stateCode: a.city.stateCode, countryCode: a.city.countryCode, placeId: a.city.placeId } };
}

function mapFlightGroup(
  result: FlightResult,
  bound: "outbound" | "inbound",
  recommendedId: string | null
): FlightOption[] {
  const options = bound === "outbound" ? result.options.outbounds : (result.options.inbounds ?? []);
  const firstFare = result.fares[0];

  return options.map((opt) => ({
    id: opt.id,
    airline: { code: opt.ciaManaging.code, name: opt.ciaManaging.name },
    from: opt.from?.code ?? "",
    to: opt.to?.code ?? "",
    price: result.cheapestPrice / 100,
    totalPrice: firstFare?.totalPrice ? firstFare.totalPrice / 100 : result.cheapestTotalPrice / 100,
    duration: opt.duration,
    departure: opt.departure,
    arrival: opt.arrival,
    stops: opt.stopsCount,
    flightNumber: opt.flightNumber,
    fareFamily: firstFare?.family ?? "",
    refundable: firstFare?.refundable ?? false,
    recommended: opt.id === recommendedId,
  }));
}

function mapHotels(results: HotelResult[], recommendedId: string | null, nights: number): HotelOption[] {
  return results.map((h) => ({
    id: h.id,
    name: h.name,
    stars: h.stars,
    pricePerNight: h.cheapestDailyPrice / 100,
    totalPrice: (h.cheapestDailyPrice * nights) / 100,
    breakfast: h.breakfast,
    refundable: h.refundable,
    agreement: h.agreement,
    thumb: h.thumb,
    neighborhood: h.address?.district ?? h.neighborhood ?? "",
    amenities: (h.amenities ?? []).map((a) => typeof a === "string" ? a : a.label),
    recommended: h.id === recommendedId,
  }));
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

async function enrichTrip(
  bffToken: string,
  oauthToken: string,
  oauthTokenType: string,
  trip: TripItinerary,
  tripIndex: number,
  prefs: { preferredCarrier: string; timePreference: string; hotelBreakfastRequired: boolean; bleisureEnabled: boolean },
  airportCache: Map<string, OnflyAirport | null>
): Promise<EnrichedTripItinerary> {
  const enriched: EnrichedTripItinerary = { ...trip };
  const prefix = `[ENRICH] Trip #${tripIndex} "${trip.event.title}"`;
  console.log(`${prefix}: START`);

  try {
    // ─── Flights — search MULTIPLE date scenarios in parallel ───
    if (trip.transport?.type === "flight") {
      const from = trip.transport.outbound.origin;
      const to = trip.transport.outbound.destination;
      const eventDate = trip.transport.outbound.suggestedDate;
      const eventReturnDate = trip.transport.return?.suggestedDate ?? eventDate;

      // Build date scenarios to compare
      const dayBefore = new Date(new Date(eventDate).getTime() - 86400000).toISOString().split("T")[0];
      const dayAfter = new Date(new Date(eventReturnDate).getTime() + 86400000).toISOString().split("T")[0];

      const scenarios: Array<{ label: string; dep: string; ret: string }> = [
        { label: "Bate-volta", dep: eventDate, ret: eventReturnDate },
      ];

      // Add buffer scenario if dates differ from bate-volta
      if (dayBefore !== eventDate || dayAfter !== eventReturnDate) {
        scenarios.push({ label: "Com buffer", dep: dayBefore, ret: dayAfter });
      }

      // Add bleisure scenario: return on next Sunday
      if (prefs.bleisureEnabled) {
        const eventEnd = new Date(eventReturnDate);
        const dayOfWeek = eventEnd.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek; // next Sunday
        const sunday = new Date(eventEnd.getTime() + daysUntilSunday * 86400000);
        const sundayStr = sunday.toISOString().split("T")[0];
        scenarios.push({ label: "Bleisure (volta domingo)", dep: dayBefore, ret: sundayStr });
      }

      console.log(`${prefix}: Searching ${scenarios.length} flight scenarios: ${scenarios.map((s) => `${s.label} (${s.dep}→${s.ret})`).join(", ")}`);

      // Resolve airports (for deep links + hotels)
      let originAirport: OnflyAirport | null = null;
      let destAirport: OnflyAirport | null = null;
      try {
        const [oa, da] = await Promise.all([
          resolveAirport(bffToken, from, airportCache),
          resolveAirport(bffToken, to, airportCache),
        ]);
        originAirport = oa;
        destAirport = da;
      } catch { /* non-critical */ }

      const fallbackOrigin: ResolvedAirport = { id: "", code: from, name: from, placeId: "", city: { name: "", stateCode: "", countryCode: "BR", placeId: "" } };
      const fallbackDest: ResolvedAirport = { id: "", code: to, name: to, placeId: "", city: { name: "", stateCode: "", countryCode: "BR", placeId: "" } };
      const resolvedOrigin = originAirport ? toResolvedAirport(originAirport) : fallbackOrigin;
      const resolvedDest = destAirport ? toResolvedAirport(destAirport) : fallbackDest;

      // Search all scenarios in parallel
      const scenarioResults = await Promise.all(
        scenarios.map(async (scenario) => {
          const t0 = Date.now();
          try {
            console.log(`${prefix}: [${scenario.label}] Searching ${from}→${to} ${scenario.dep}/${scenario.ret}...`);
            const quotes = await createAndSearchFlights(bffToken, "Bearer", {
              from, to, departure: scenario.dep, returnDate: scenario.ret,
            });
            const quote = quotes?.[0];
            if (!quote) return { ...scenario, quote: null, flightData: [] as FlightResult[] };

            const flightData = quote.response?.data ?? [];
            console.log(`${prefix}: [${scenario.label}] OK in ${Date.now() - t0}ms — ${flightData.length} groups, cheapest R$${flightData[0] ? (flightData[0].cheapestTotalPrice / 100).toFixed(2) : "N/A"}`);
            return { ...scenario, quote, flightData };
          } catch (err) {
            console.error(`${prefix}: [${scenario.label}] FAILED in ${Date.now() - t0}ms`, err);
            return { ...scenario, quote: null, flightData: [] as FlightResult[] };
          }
        })
      );

      // Build FlightScenario objects
      const flightScenarios: FlightScenario[] = [];
      for (const result of scenarioResults) {
        if (result.flightData.length === 0) continue;

        const recommendedGroupId = pickRecommendedFlightId(result.flightData, prefs);

        const mapOptions = (groups: FlightResult[], bound: "outbounds" | "inbounds"): FlightOption[] => {
          const options: FlightOption[] = [];
          for (const group of groups) {
            const isRec = group.id === recommendedGroupId;
            const cia = group.fares[0]?.ciaManaging ?? { code: "??", name: "?" };
            for (const opt of (group.options[bound] ?? [])) {
              options.push({
                id: opt.id,
                airline: { code: cia.code, name: cia.name },
                from: opt.from?.code ?? "",
                to: opt.to?.code ?? "",
                price: group.cheapestPrice / 100,
                totalPrice: group.cheapestTotalPrice / 100,
                duration: opt.duration,
                departure: opt.departure,
                arrival: opt.arrival,
                stops: opt.stopsCount,
                flightNumber: opt.flightNumber,
                fareFamily: group.fares[0]?.family ?? "",
                refundable: group.fares[0]?.refundable ?? false,
                recommended: isRec,
              });
            }
          }
          return options;
        };

        const outboundOpts = mapOptions(result.flightData, "outbounds");
        const inboundOpts = mapOptions(result.flightData, "inbounds");
        const cheapest = result.flightData[0]?.cheapestTotalPrice ?? 0;
        const quoteId = result.quote!.id;

        flightScenarios.push({
          label: result.label,
          departureDate: result.dep,
          returnDate: result.ret,
          outbound: outboundOpts.length > 0 ? { origin: resolvedOrigin, destination: resolvedDest, options: outboundOpts, quoteId, checkoutLink: `${CHECKOUT_BASE}/${quoteId}` } : null,
          inbound: inboundOpts.length > 0 ? { origin: resolvedDest, destination: resolvedOrigin, options: inboundOpts, quoteId, checkoutLink: `${CHECKOUT_BASE}/${quoteId}` } : null,
          cheapestTotal: cheapest / 100,
          recommended: false,
        });
      }

      // Mark cheapest scenario as recommended
      if (flightScenarios.length > 0) {
        const cheapestIdx = flightScenarios.reduce((best, s, i) => s.cheapestTotal < flightScenarios[best].cheapestTotal ? i : best, 0);
        flightScenarios[cheapestIdx].recommended = true;

        for (const s of flightScenarios) {
          console.log(`${prefix}: Scenario "${s.label}" ${s.departureDate}/${s.returnDate}: cheapest R$${s.cheapestTotal.toFixed(2)}, outbound=${s.outbound?.options.length ?? 0}, inbound=${s.inbound?.options.length ?? 0}${s.recommended ? " ★ BEST" : ""}`);
        }

        // Use the recommended scenario for the main enrichment (backward compat)
        const best = flightScenarios.find((s) => s.recommended) ?? flightScenarios[0];
        enriched.flightOutbound = best.outbound;
        enriched.flightReturn = best.inbound;
      }

      enriched.flightScenarios = flightScenarios;
    } else {
      console.log(`${prefix}: No flight transport, skipping`);
    }

    // ─── Hotels (single call — creates quote + returns results) ───
    if (trip.hotel?.needed && trip.hotel.checkIn && trip.hotel.checkOut) {
      const destIata = trip.transport?.outbound.destination;
      let destAirport = destIata ? airportCache.get(destIata.toUpperCase()) : null;
      if (!destAirport && destIata) {
        destAirport = await resolveAirport(bffToken, destIata, airportCache);
      }

      const cityPlaceId = destAirport?.city?.placeId;
      console.log(`${prefix}: Hotel needed: ${trip.hotel.checkIn}→${trip.hotel.checkOut}, placeId=${cityPlaceId ?? "NOT AVAILABLE"} (${destAirport?.city?.name ?? "?"})`);

      if (cityPlaceId) {
        const t0 = Date.now();
        try {
          const quotes = await createAndSearchHotels(bffToken, "Bearer", {
            placeId: cityPlaceId,
            checkIn: trip.hotel.checkIn,
            checkOut: trip.hotel.checkOut,
          });

          const quote = quotes?.[0];
          if (!quote) {
            console.warn(`${prefix}: No hotel quote returned`);
          } else {
            const quoteId = quote.id;
            const hotelData = quote.response?.data ?? [];
            console.log(`${prefix}: Hotel quote OK in ${Date.now() - t0}ms — quoteId=${quoteId}, ${hotelData.length} hotels`);

            if (hotelData.length > 0) {
              const sample = hotelData[0];
              console.log(`${prefix}: First hotel: "${sample.name}" ${sample.stars}*, R$${(sample.cheapestDailyPrice / 100).toFixed(2)}/noite, cafe=${sample.breakfast}, bairro=${sample.address?.district ?? sample.neighborhood ?? "?"}`);
            }

            const recommendedId = pickRecommendedHotelId(hotelData, prefs);
            const nights = nightsBetween(trip.hotel.checkIn, trip.hotel.checkOut);

            enriched.hotelResults = {
              recommended: mapHotels(hotelData, recommendedId, nights),
              nearPoi: [],
              quoteId,
              checkoutLink: `${CHECKOUT_BASE}/${quoteId}`,
            };
            console.log(`${prefix}: Hotel enriched: ${enriched.hotelResults.recommended.length} options, ${nights} nights`);
          }
        } catch (err) {
          console.error(`${prefix}: Hotel FAILED`, err);
        }
      } else {
        console.warn(`${prefix}: Cannot search hotels — no city placeId`);
      }
    } else {
      console.log(`${prefix}: No hotel needed`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`${prefix}: FATAL`, msg);
    enriched.enrichmentError = msg;
  }

  console.log(`${prefix}: DONE — outbound=${enriched.flightOutbound ? enriched.flightOutbound.options.length + " flights" : "null"}, return=${enriched.flightReturn ? enriched.flightReturn.options.length + " flights" : "null"}, hotels=${enriched.hotelResults ? enriched.hotelResults.recommended.length + " hotels" : "null"}`);
  return enriched;
}

async function resolveAirport(
  bffToken: string,
  iata: string,
  cache: Map<string, OnflyAirport | null>
): Promise<OnflyAirport | null> {
  const upper = iata.toUpperCase();
  if (cache.has(upper)) return cache.get(upper) ?? null;

  try {
    const results = await searchAirports(bffToken, "Bearer", upper);
    const match = results.find((a) => a.code === upper) ?? null;
    cache.set(upper, match);
    return match;
  } catch {
    cache.set(upper, null);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log("[ENRICH] ═══════════════════════════════════════════════");
  console.log("[ENRICH] POST /api/itinerary/enrich — START");

  try {
    const session = await requireSession();
    console.log(`[ENRICH] Session OK — user=${session.onflyUserId}`);

    const prefsRow = await getPreferences(session.onflyUserId);
    if (!prefsRow) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    const preferences = dbRowToPreferences(prefsRow);
    console.log(`[ENRICH] Prefs: carrier=${preferences.preferredCarrier || "any"}, time=${preferences.timePreference}, breakfast=${preferences.hotelBreakfastRequired}`);

    // Fetch internal BFF token
    console.log("[ENRICH] Fetching BFF token...");
    const bffToken = await getInternalBffToken(session.accessToken, session.tokenType);
    console.log(`[ENRICH] BFF token OK`);

    const body = await request.json();
    // Accept either full TripItinerary[] or raw CalendarEvent[] (new flow)
    let { trips } = body as { trips: TripItinerary[] };
    const { events } = body as { events?: CalendarEvent[] };

    // If events are provided (new flow), build minimal trip stubs from them
    if (events?.length && (!trips || trips.length === 0)) {
      console.log(`[ENRICH] Received ${events.length} raw calendar events, building trip stubs from preferences`);
      const homeAirport = preferences.homeAirport || "CNF";
      const style = preferences.itineraryStyle;

      trips = events.map((event) => {
        const destCode = resolveDestinationCode(event.location ?? "");
        console.log(`[ENRICH] Event "${event.title}" location="${event.location}" → dest code: ${destCode ?? "UNKNOWN"}`);
        const eventDate = new Date(event.start);
        const departureDate = style === "buffer" && preferences.bufferArriveDayBefore
          ? new Date(eventDate.getTime() - 86400000).toISOString().split("T")[0]
          : eventDate.toISOString().split("T")[0];

        const eventEnd = new Date(event.end);
        const returnDate = style === "buffer" && preferences.bufferDepartDayAfter
          ? new Date(eventEnd.getTime() + 86400000).toISOString().split("T")[0]
          : eventEnd.toISOString().split("T")[0];

        const needsHotel = style === "buffer" || departureDate !== returnDate;

        return {
          event: {
            title: event.title,
            datetime: event.start,
            location: event.location ?? "",
            durationHours: Math.max(1, (eventEnd.getTime() - eventDate.getTime()) / 3600000),
          },
          transport: destCode ? {
            type: "flight" as const,
            outbound: { origin: homeAirport, destination: destCode, suggestedDate: departureDate, suggestedTime: "", reason: "" },
            return: { origin: destCode, destination: homeAirport, suggestedDate: returnDate, suggestedTime: "", reason: "" },
          } : null,
          hotel: {
            needed: needsHotel,
            checkIn: needsHotel ? departureDate : undefined,
            checkOut: needsHotel ? returnDate : undefined,
          },
          mobility: [],
          conflicts: [],
          bleisure: null,
          calendarEventsToCreate: [],
        };
      });
    }

    console.log(`[ENRICH] ${trips?.length ?? 0} trips to enrich`);
    if (!trips?.length) return NextResponse.json({ data: [] });

    const prefs = {
      preferredCarrier: preferences.preferredCarrier,
      timePreference: preferences.timePreference,
      hotelBreakfastRequired: preferences.hotelBreakfastRequired,
      bleisureEnabled: preferences.bleisureEnabled,
    };

    const airportCache = new Map<string, OnflyAirport | null>();

    const enriched = await Promise.all(
      trips.map((trip, i) =>
        enrichTrip(bffToken, session.accessToken, session.tokenType, trip, i, prefs, airportCache)
      )
    );

    console.log(`[ENRICH] ALL DONE in ${Date.now() - startTime}ms`);
    console.log("[ENRICH] ═══════════════════════════════════════════════");

    return NextResponse.json({ data: enriched });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(`[ENRICH] FATAL after ${Date.now() - startTime}ms:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
