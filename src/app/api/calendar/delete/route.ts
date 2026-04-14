import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getCalendarConnection, upsertCalendarConnection, getItineraryCalendarEvents, deleteItinerary } from "@/lib/db";
import { deleteEvent, refreshGoogleToken } from "@/lib/google-calendar";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const connection = await getCalendarConnection(session.onflyUserId, "google");

    if (!connection) {
      return NextResponse.json({ error: "No Google Calendar connected" }, { status: 400 });
    }

    let accessToken = connection.access_token as string;
    const tokenExpiry = new Date(connection.token_expiry as string);

    if (tokenExpiry <= new Date()) {
      const refreshed = await refreshGoogleToken(connection.refresh_token as string);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await upsertCalendarConnection(session.onflyUserId, "google", {
        accessToken: refreshed.access_token,
        refreshToken: connection.refresh_token as string,
        tokenExpiry: newExpiry,
      });
    }

    const body = await request.json();
    const { itineraryId, eventIds } = body as { itineraryId?: number; eventIds?: string[] };

    // Get event IDs from itinerary if not provided directly
    let idsToDelete = eventIds ?? [];
    if (itineraryId && idsToDelete.length === 0) {
      idsToDelete = await getItineraryCalendarEvents(itineraryId);
    }

    // Delete events from Google Calendar
    const results = await Promise.allSettled(
      idsToDelete.map((id) => deleteEvent(accessToken, id))
    );

    const deleted = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // Delete itinerary from DB
    if (itineraryId) {
      await deleteItinerary(itineraryId);
    }

    return NextResponse.json({ data: { deleted, failed, total: idsToDelete.length } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Calendar delete error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
