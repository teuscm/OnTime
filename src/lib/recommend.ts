import type { FlightResult, HotelResult } from "@/lib/onfly";

interface FlightPrefs {
  preferredCarrier: string;
  timePreference: string;
}

interface HotelPrefs {
  hotelBreakfastRequired: boolean;
}

const TIME_WINDOWS: Record<string, { min: number; max: number }> = {
  morning: { min: 5, max: 11 },
  midday: { min: 10, max: 15 },
  evening: { min: 15, max: 23 },
};

const CARRIER_MAP: Record<string, string> = {
  LATAM: "LA",
  GOL: "G3",
  Azul: "AD",
};

function scoreFlight(flight: FlightResult, prefs: FlightPrefs): number {
  let score = 0;
  score += (flight.cheapestTotalPrice / 100) * 0.4;

  if (prefs.preferredCarrier) {
    const preferredCode = CARRIER_MAP[prefs.preferredCarrier];
    const hasPreferred = flight.fares.some((f) => f.ciaManaging.code === preferredCode);
    if (hasPreferred) score -= 5000;
  }

  const firstOutbound = flight.options.outbounds?.[0];
  if (firstOutbound && prefs.timePreference) {
    const window = TIME_WINDOWS[prefs.timePreference];
    if (window) {
      const hour = new Date(firstOutbound.departure).getHours();
      if (hour >= window.min && hour <= window.max) score -= 3000;
    }
  }

  const duration = firstOutbound?.duration ?? 999;
  score += duration * 0.1;
  return score;
}

export function pickRecommendedFlightId(flights: FlightResult[], prefs: FlightPrefs): string | null {
  if (flights.length === 0) return null;
  const preferredCode = prefs.preferredCarrier ? CARRIER_MAP[prefs.preferredCarrier] : null;

  // Rule: prefer carrier UNLESS cheapest overall is >15% cheaper
  const cheapestOverall = Math.min(...flights.map((f) => f.cheapestTotalPrice));
  const preferredFlights = preferredCode ? flights.filter((f) => f.fares.some((fare) => fare.ciaManaging.code === preferredCode)) : [];
  const cheapestPreferred = preferredFlights.length > 0 ? Math.min(...preferredFlights.map((f) => f.cheapestTotalPrice)) : Infinity;

  const savingsPercent = cheapestPreferred > 0 ? ((cheapestPreferred - cheapestOverall) / cheapestPreferred) * 100 : 0;
  const shouldOverrideCarrier = savingsPercent > 15;

  let bestId = flights[0].id;
  let bestScore = Infinity;
  for (const flight of flights) {
    let s = scoreFlight(flight, prefs);

    // If carrier preference should hold, give massive bonus to preferred
    if (!shouldOverrideCarrier && preferredCode) {
      const hasPreferred = flight.fares.some((f) => f.ciaManaging.code === preferredCode);
      if (hasPreferred) s -= 10000; // override the base scoring
    }

    if (s < bestScore) { bestScore = s; bestId = flight.id; }
  }
  return bestId;
}

function scoreHotel(hotel: HotelResult, prefs: HotelPrefs): number {
  let score = 0;
  score += (hotel.cheapestDailyPrice / 100) * 0.3;
  if (prefs.hotelBreakfastRequired && hotel.breakfast) score -= 4000;
  if (hotel.stars >= 3 && hotel.stars <= 4) score -= 2000;
  if (hotel.agreement) score -= 3000;
  if (hotel.refundable) score -= 500;
  return score;
}

export function pickRecommendedHotelId(hotels: HotelResult[], prefs: HotelPrefs): string | null {
  if (hotels.length === 0) return null;
  let bestId = hotels[0].id;
  let bestScore = Infinity;
  for (const hotel of hotels) {
    const s = scoreHotel(hotel, prefs);
    if (s < bestScore) { bestScore = s; bestId = hotel.id; }
  }
  return bestId;
}
