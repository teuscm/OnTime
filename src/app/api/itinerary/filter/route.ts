import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPreferences } from "@/lib/db";
import { filterTravelEvents } from "@/lib/claude";
import type { CalendarEvent } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const prefsRow = getPreferences(session.onflyUserId);

    if (!prefsRow) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    const homeCity = prefsRow.home_city as string;
    const body = await request.json();
    const { events } = body as { events: CalendarEvent[] };

    if (!events?.length) {
      return NextResponse.json({ data: [] });
    }

    const travelEvents = await filterTravelEvents(events, homeCity);
    return NextResponse.json({ data: travelEvents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Filter events error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
