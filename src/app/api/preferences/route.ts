import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPreferences, upsertPreferences } from "@/lib/db";

export async function GET() {
  try {
    const session = await requireSession();
    const prefs = await getPreferences(session.onflyUserId);

    if (!prefs) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: prefs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();

    // Map camelCase from frontend to snake_case for DB
    const dbFields: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      transportType: "transport_type",
      preferredCarrier: "preferred_carrier",
      homeCity: "home_city",
      homeAirport: "home_airport",
      homeLat: "home_lat",
      homeLng: "home_lng",
      itineraryStyle: "itinerary_style",
      bufferArriveDayBefore: "buffer_arrive_day_before",
      bufferDepartDayAfter: "buffer_depart_day_after",
      timePreference: "time_preference",
      hotelShareRoom: "hotel_share_room",
      hotelBreakfastRequired: "hotel_breakfast_required",
      hotelType: "hotel_type",
      prefersRentalCar: "prefers_rental_car",
      mobilityPreference: "mobility_preference",
      bleisureEnabled: "bleisure_enabled",
      bleisureWithCompanion: "bleisure_with_companion",
      hotelMaxDailyPrice: "hotel_max_daily_price",
      hotelMaxDistance: "hotel_max_distance",
      onboardingCompleted: "onboarding_completed",
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (camel in body) {
        const value = body[camel];
        // Convert booleans to integers for SQLite
        dbFields[snake] = typeof value === "boolean" ? (value ? 1 : 0) : value;
      }
    }

    await upsertPreferences(session.onflyUserId, dbFields);

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
