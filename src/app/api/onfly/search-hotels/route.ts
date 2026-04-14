import { NextRequest, NextResponse } from "next/server";
export const maxDuration = 120;
import { requireSession } from "@/lib/auth";
import { getPreferences, dbRowToPreferences } from "@/lib/db";
import { getInternalBffToken, searchPoi, createAndSearchHotels, searchHotels } from "@/lib/onfly";
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

    // Accept either place_id (direct) or location (resolve via POI autocomplete)
    let placeId = searchParams.get("place_id");
    const location = searchParams.get("location");
    const checkIn = searchParams.get("check_in");
    const checkOut = searchParams.get("check_out");
    const maxDistance = parseInt(searchParams.get("max_distance") ?? "2000");
    const minPrice = parseInt(searchParams.get("min_price") ?? "6500");
    const maxPrice = parseInt(searchParams.get("max_price") ?? "500000");

    if ((!placeId && !location) || !checkIn || !checkOut) {
      return NextResponse.json({ error: "place_id or location, check_in, and check_out are required" }, { status: 400 });
    }

    const bffToken = await getInternalBffToken(session.accessToken, session.tokenType);

    // Step 1: Resolve POI if location provided
    if (!placeId && location) {
      const poi = await searchPoi(bffToken, "Bearer", location);
      if (!poi) {
        return NextResponse.json({ error: `Could not resolve location: ${location}` }, { status: 404 });
      }
      placeId = poi.placeId;
    }

    // Step 2: Create hotel quote
    const quotes = await createAndSearchHotels(bffToken, "Bearer", { placeId: placeId!, checkIn, checkOut });

    const quote = quotes?.[0];
    if (!quote) {
      return NextResponse.json({ data: { quoteId: "", hotelQuoteId: "", checkoutLink: "", recommended: [], nearPoi: [] } });
    }

    const quoteId = quote.id;
    const hotelQuoteId = quote.item.id;

    // Step 3: Two filtered searches in parallel
    const filters = {
      priceDailyMin: minPrice,
      priceDailyMax: maxPrice,
      poiDistanceLessThan: maxDistance,
    };

    const [recommendedRes, nearPoiRes] = await Promise.all([
      searchHotels(bffToken, "Bearer", quoteId, hotelQuoteId, filters, { key: "recommended", order: "asc" }),
      searchHotels(bffToken, "Bearer", quoteId, hotelQuoteId, filters, { key: "distanceToPoi", order: "asc" }),
    ]);

    // Fallback: if filters are too restrictive (0 results), retry without price/distance filters
    if ((recommendedRes.data?.length ?? 0) === 0 && (nearPoiRes.data?.length ?? 0) === 0) {
      const [recFallback, nearFallback] = await Promise.all([
        searchHotels(bffToken, "Bearer", quoteId, hotelQuoteId, {}, { key: "recommended", order: "asc" }),
        searchHotels(bffToken, "Bearer", quoteId, hotelQuoteId, {}, { key: "distanceToPoi", order: "asc" }),
      ]);
      recommendedRes.data = recFallback.data;
      nearPoiRes.data = nearFallback.data;
    }

    // Apply our heuristic recommendation
    const prefsRow = await getPreferences(session.onflyUserId);
    const prefs = prefsRow ? dbRowToPreferences(prefsRow) : null;
    const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));

    const recIdRec = pickRecommendedHotelId(recommendedRes.data ?? [], { hotelBreakfastRequired: prefs?.hotelBreakfastRequired ?? false });
    const recIdNear = pickRecommendedHotelId(nearPoiRes.data ?? [], { hotelBreakfastRequired: prefs?.hotelBreakfastRequired ?? false });

    return NextResponse.json({
      data: {
        quoteId,
        hotelQuoteId,
        checkoutLink: `${CHECKOUT_BASE}/${quoteId}`,
        recommended: mapHotels(recommendedRes.data ?? [], nights, recIdRec),
        nearPoi: mapHotels(nearPoiRes.data ?? [], nights, recIdNear),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[HOTELS] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
