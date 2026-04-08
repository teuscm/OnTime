import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createHotelQuote, searchHotels } from "@/lib/onfly";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);

    const cityId = searchParams.get("city_id");
    const checkIn = searchParams.get("check_in");
    const checkOut = searchParams.get("check_out");

    if (!cityId || !checkIn || !checkOut) {
      return NextResponse.json(
        { error: "city_id, check_in, and check_out are required" },
        { status: 400 }
      );
    }

    // Create hotel quote then search
    const { quoteId, hotelQuoteId } = await createHotelQuote(
      session.accessToken,
      session.tokenType,
      { cityId, checkIn, checkOut }
    );

    const filters: Record<string, unknown> = {};
    const breakfast = searchParams.get("breakfast");
    const stars = searchParams.get("stars");

    if (breakfast === "true") filters.breakfast = true;
    if (stars) filters.stars = stars.split(",").map(Number);

    const results = await searchHotels(
      session.accessToken,
      session.tokenType,
      quoteId,
      hotelQuoteId,
      filters
    );

    return NextResponse.json({ data: results.data, quoteId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Hotel search error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
