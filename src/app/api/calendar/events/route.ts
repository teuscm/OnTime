import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getCalendarConnection } from "@/lib/db";
import { fetchEvents, refreshGoogleToken } from "@/lib/google-calendar";
import { upsertCalendarConnection } from "@/lib/db";

export async function GET() {
  try {
    const session = await requireSession();
    const connection = await getCalendarConnection(session.onflyUserId, "google");

    if (!connection) {
      return NextResponse.json({ error: "No Google Calendar connected" }, { status: 400 });
    }

    let accessToken = connection.access_token as string;
    const tokenExpiry = new Date(connection.token_expiry as string);

    // Refresh token if expired
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

    // Fetch next 60 days
    const now = new Date();
    const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const events = await fetchEvents(
      accessToken,
      now.toISOString(),
      sixtyDaysLater.toISOString()
    );

    const mapped = events.map((e) => ({
      id: e.id,
      title: e.summary,
      start: e.start.dateTime ?? e.start.date ?? "",
      end: e.end.dateTime ?? e.end.date ?? "",
      location: e.location ?? null,
      attendees: e.attendees?.map((a) => a.email) ?? [],
      isRecurring: !!e.recurringEventId,
      htmlLink: e.htmlLink,
    }));

    return NextResponse.json({ data: mapped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Calendar events error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
