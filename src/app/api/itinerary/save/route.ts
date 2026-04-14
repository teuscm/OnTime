import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { saveItineraryWithCalendarEvents } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const { eventId, itineraryJson, calendarEventIds } = body as {
      eventId: string;
      itineraryJson: string;
      calendarEventIds: string[];
    };

    const id = await saveItineraryWithCalendarEvents(
      session.onflyUserId,
      eventId ?? "",
      itineraryJson ?? "{}",
      calendarEventIds ?? []
    );

    return NextResponse.json({ data: { id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Save itinerary error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
