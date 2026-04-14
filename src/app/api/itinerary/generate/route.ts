import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPreferences, dbRowToPreferences, saveItinerary } from "@/lib/db";
import { generateItinerary } from "@/lib/claude";
import type { OnflyDataForClaude } from "@/lib/claude";
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
    const { travelEvents, allEvents, onflyData } = body as {
      travelEvents: CalendarEvent[];
      allEvents: CalendarEvent[];
      onflyData?: OnflyDataForClaude[];
    };

    if (!travelEvents?.length) {
      return NextResponse.json({ error: "No travel events provided" }, { status: 400 });
    }

    if (onflyData) {
      console.log(`[GENERATE] Received Onfly data for ${onflyData.length} trips`);
      for (const d of onflyData) {
        const scenarios = d.flightScenarios ?? [];
        const hotels = d.hotels ?? [];
        console.log(`[GENERATE]   "${d.eventTitle}": ${scenarios.length} flight scenarios, ${hotels.length} hotels`);
      }
    } else {
      console.log("[GENERATE] No Onfly data — Claude will generate without real prices");
    }

    const itinerary = await generateItinerary(preferences, travelEvents, allEvents, onflyData);

    // Log Claude's recommendations
    for (const trip of itinerary.trips) {
      console.log(`[GENERATE] Trip "${trip.event.title}" recommendations:`);
      console.log(`[GENERATE]   outbound flight: ${trip.recommendedFlightOutId ?? "NOT SET"}`);
      console.log(`[GENERATE]   return flight: ${trip.recommendedFlightReturnId ?? "NOT SET"}`);
      console.log(`[GENERATE]   hotel: ${trip.recommendedHotelId ?? "NOT SET"}`);
      console.log(`[GENERATE]   reason: ${trip.recommendationReason ?? "NOT SET"}`);
    }

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
