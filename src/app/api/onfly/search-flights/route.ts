import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPreferences, dbRowToPreferences } from "@/lib/db";
import { getInternalBffToken, createAndSearchFlights, searchAirports } from "@/lib/onfly";
import type { OnflyAirport } from "@/lib/onfly";
import { pickRecommendedFlightId } from "@/lib/recommend";
import type { FlightOption, ResolvedAirport } from "@/types";

const CHECKOUT_BASE = "https://app.onfly.com/travel/#/travel/booking/checkout";

function toResolved(a: OnflyAirport): ResolvedAirport {
  return { id: a.id, code: a.code, name: a.name, placeId: a.placeId, city: { name: a.city.name, stateCode: a.city.stateCode, countryCode: a.city.countryCode, placeId: a.city.placeId } };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const departureDate = searchParams.get("departure_date");
    const returnDate = searchParams.get("return_date") ?? undefined;

    if (!from || !to || !departureDate) {
      return NextResponse.json({ error: "from, to, and departure_date are required" }, { status: 400 });
    }

    const bffToken = await getInternalBffToken(session.accessToken, session.tokenType);

    // Search flights
    const quotes = await createAndSearchFlights(bffToken, "Bearer", {
      from, to, departure: departureDate, returnDate,
    });

    const quote = quotes?.[0];
    if (!quote || !quote.response?.data?.length) {
      return NextResponse.json({ data: { quoteId: "", checkoutLink: "", cheapestTotal: 0, outbound: [], inbound: [], resolvedAirports: null } });
    }

    const quoteId = quote.id;
    const flightData = quote.response.data;

    // Get user prefs for recommendation
    const prefsRow = await getPreferences(session.onflyUserId);
    const prefs = prefsRow ? dbRowToPreferences(prefsRow) : null;
    const recommendedGroupId = pickRecommendedFlightId(flightData, {
      preferredCarrier: prefs?.preferredCarrier ?? "",
      timePreference: prefs?.timePreference ?? "morning",
    });

    // Pick best individual flight within recommended group (by time preference)
    const timeWindows: Record<string, { min: number; max: number }> = {
      morning: { min: 5, max: 11 }, midday: { min: 10, max: 15 }, evening: { min: 15, max: 23 },
    };
    const timePref = prefs?.timePreference ?? "morning";
    const tw = timeWindows[timePref] ?? timeWindows.morning;

    const recGroup = flightData.find((g) => g.id === recommendedGroupId);

    function pickBestTime(opts: Array<{ id: string; departure: string }>): string | null {
      if (opts.length === 0) return null;
      let bestId = opts[0].id;
      let bestDist = Infinity;
      for (const opt of opts) {
        const hour = new Date(opt.departure).getHours();
        const dist = (hour >= tw.min && hour <= tw.max) ? 0 : Math.min(Math.abs(hour - tw.min), Math.abs(hour - tw.max));
        if (dist < bestDist) { bestDist = dist; bestId = opt.id; }
      }
      return bestId;
    }

    const bestOutboundId = recGroup ? pickBestTime(recGroup.options.outbounds ?? []) : null;
    const bestInboundId = recGroup ? pickBestTime(recGroup.options.inbounds ?? []) : null;
    // Map all options — only ONE flight per direction is recommended
    const outbound: FlightOption[] = [];
    const inbound: FlightOption[] = [];

    for (const group of flightData) {
      const cia = group.fares[0]?.ciaManaging ?? { code: "??", name: "?" };

      for (const opt of (group.options.outbounds ?? [])) {
        outbound.push({
          id: opt.id,
          airline: { code: cia.code, name: cia.name },
          from: opt.from?.code ?? from,
          to: opt.to?.code ?? to,
          price: group.cheapestPrice / 100,
          totalPrice: group.cheapestTotalPrice / 100,
          duration: opt.duration,
          departure: opt.departure,
          arrival: opt.arrival,
          stops: opt.stopsCount,
          flightNumber: opt.flightNumber,
          fareFamily: group.fares[0]?.family ?? "",
          refundable: group.fares[0]?.refundable ?? false,
          recommended: opt.id === bestOutboundId,
        });
      }

      for (const opt of (group.options.inbounds ?? [])) {
        inbound.push({
          id: opt.id,
          airline: { code: cia.code, name: cia.name },
          from: opt.from?.code ?? to,
          to: opt.to?.code ?? from,
          price: group.cheapestPrice / 100,
          totalPrice: group.cheapestTotalPrice / 100,
          duration: opt.duration,
          departure: opt.departure,
          arrival: opt.arrival,
          stops: opt.stopsCount,
          flightNumber: opt.flightNumber,
          fareFamily: group.fares[0]?.family ?? "",
          refundable: group.fares[0]?.refundable ?? false,
          recommended: opt.id === bestInboundId,
        });
      }
    }

    // Resolve airports for placeId (needed for hotel search)
    let resolvedAirports: { origin: ResolvedAirport; destination: ResolvedAirport } | null = null;
    try {
      const [originResults, destResults] = await Promise.all([
        searchAirports(bffToken, "Bearer", from),
        searchAirports(bffToken, "Bearer", to),
      ]);
      const origin = originResults.find((a) => a.code === from.toUpperCase());
      const dest = destResults.find((a) => a.code === to.toUpperCase()) ?? destResults[0];
      if (origin && dest) {
        resolvedAirports = { origin: toResolved(origin), destination: toResolved(dest) };
      }
    } catch { /* non-critical */ }

    const cheapestTotal = flightData[0]?.cheapestTotalPrice ? flightData[0].cheapestTotalPrice / 100 : 0;

    return NextResponse.json({
      data: {
        quoteId,
        checkoutLink: `${CHECKOUT_BASE}/${quoteId}`,
        cheapestTotal,
        outbound,
        inbound,
        resolvedAirports,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Flight search error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
