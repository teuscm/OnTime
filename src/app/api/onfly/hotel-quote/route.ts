import { NextRequest, NextResponse } from "next/server";
export const maxDuration = 120;
import { requireSession } from "@/lib/auth";
import { getInternalBffToken, searchPoi, createAndSearchHotels } from "@/lib/onfly";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const { location, checkIn, checkOut } = body as { location: string; checkIn: string; checkOut: string };

    if (!location || !checkIn || !checkOut) {
      return NextResponse.json({ error: "location, checkIn, and checkOut are required" }, { status: 400 });
    }

    const bffToken = await getInternalBffToken(session.accessToken, session.tokenType);

    // Step 1: Resolve POI
    const poi = await searchPoi(bffToken, "Bearer", location);
    if (!poi) {
      return NextResponse.json({ error: `Could not resolve location: ${location}` }, { status: 404 });
    }
    // Step 2: Create quote
    const quotes = await createAndSearchHotels(bffToken, "Bearer", { placeId: poi.placeId, checkIn, checkOut });

    const quote = quotes?.[0];
    if (!quote) {
      return NextResponse.json({ error: "No hotel quote returned" }, { status: 502 });
    }

    return NextResponse.json({
      data: {
        quoteId: quote.id,
        hotelQuoteId: quote.item.id,
        initialCount: quote.response?.data?.length ?? 0,
        poiDescription: poi.description,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[HOTEL-QUOTE] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
