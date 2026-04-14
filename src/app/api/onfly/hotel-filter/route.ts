import { NextRequest, NextResponse } from "next/server";
export const maxDuration = 30;
import { requireSession } from "@/lib/auth";
import { getPreferences, dbRowToPreferences } from "@/lib/db";
import { getInternalBffToken, searchHotels } from "@/lib/onfly";
import { pickRecommendedHotelId } from "@/lib/recommend";
import type { HotelResult } from "@/lib/onfly";
import type { HotelOption } from "@/types";

const CHECKOUT_BASE = "https://app.onfly.com/travel/#/travel/booking/checkout";

function mapHotels(results: HotelResult[], nights: number, recId: string | null): HotelOption[] {
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
    recommended: h.id === recId,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);

    const quoteId = searchParams.get("quote_id");
    const hotelQuoteId = searchParams.get("hotel_quote_id");
    const sortKey = searchParams.get("sort") ?? "recommended"; // "recommended" | "distanceToPoi"
    const checkIn = searchParams.get("check_in") ?? "";
    const checkOut = searchParams.get("check_out") ?? "";
    const maxDistance = searchParams.get("max_distance");
    const minPrice = searchParams.get("min_price");
    const maxPrice = searchParams.get("max_price");

    if (!quoteId || !hotelQuoteId) {
      return NextResponse.json({ error: "quote_id and hotel_quote_id are required" }, { status: 400 });
    }

    const bffToken = await getInternalBffToken(session.accessToken, session.tokenType);

    const filters: Record<string, unknown> = {};
    if (maxDistance) filters.poiDistanceLessThan = parseInt(maxDistance);
    if (minPrice) filters.priceDailyMin = parseInt(minPrice);
    if (maxPrice) filters.priceDailyMax = parseInt(maxPrice);

    console.log(`[HOTEL-FILTER] sort=${sortKey}, filters=${JSON.stringify(filters)}`);
    const t0 = Date.now();

    let res = await searchHotels(bffToken, "Bearer", quoteId, hotelQuoteId, filters, { key: sortKey, order: "asc" });

    // Fallback: if filters too restrictive, retry with wide defaults
    if ((res.data?.length ?? 0) === 0 && Object.keys(filters).length > 0) {
      console.log(`[HOTEL-FILTER] 0 results with filters, retrying with wide defaults...`);
      res = await searchHotels(bffToken, "Bearer", quoteId, hotelQuoteId, {
        priceDailyMin: 5000,
        priceDailyMax: 500000,
        poiDistanceLessThan: 10000,
      }, { key: sortKey, order: "asc" });
    }

    console.log(`[HOTEL-FILTER] Done in ${Date.now() - t0}ms — ${res.data?.length ?? 0} hotels (sort: ${sortKey})`);

    const prefsRow = await getPreferences(session.onflyUserId);
    const prefs = prefsRow ? dbRowToPreferences(prefsRow) : null;
    const nights = checkIn && checkOut ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 1;
    const recId = pickRecommendedHotelId(res.data ?? [], { hotelBreakfastRequired: prefs?.hotelBreakfastRequired ?? false });

    return NextResponse.json({
      data: {
        checkoutLink: `${CHECKOUT_BASE}/${quoteId}`,
        options: mapHotels(res.data ?? [], nights, recId),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[HOTEL-FILTER] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
