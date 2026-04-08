import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPreferences, dbRowToPreferences, saveItinerary } from "@/lib/db";
import { generateItinerary } from "@/lib/claude";
import type { CalendarEvent } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const prefsRow = await getPreferences(session.onflyUserId);

    if (!prefsRow) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    const preferences = dbRowToPreferences(prefsRow);
    const body = await request.json();
    const { travelEvents, allEvents } = body as {
      travelEvents: CalendarEvent[];
      allEvents: CalendarEvent[];
    };

    if (!travelEvents?.length) {
      return NextResponse.json({ error: "No travel events provided" }, { status: 400 });
    }

    const itinerary = await generateItinerary(preferences, travelEvents, allEvents);

    // Save each trip itinerary
    for (const trip of itinerary.trips) {
      const matchingEvent = travelEvents.find(
        (e) => e.title === trip.event.title
      );
      await saveItinerary(
        session.onflyUserId,
        matchingEvent?.id ?? "",
        JSON.stringify(trip)
      );
    }

    return NextResponse.json({ data: itinerary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Itinerary generation error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
