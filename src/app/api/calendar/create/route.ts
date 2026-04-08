import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getCalendarConnection, upsertCalendarConnection } from "@/lib/db";
import { createEvent, refreshGoogleToken } from "@/lib/google-calendar";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const connection = getCalendarConnection(session.onflyUserId, "google");

    if (!connection) {
      return NextResponse.json({ error: "No Google Calendar connected" }, { status: 400 });
    }

    let accessToken = connection.access_token as string;
    const tokenExpiry = new Date(connection.token_expiry as string);

    if (tokenExpiry <= new Date()) {
      const refreshed = await refreshGoogleToken(connection.refresh_token as string);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      upsertCalendarConnection(session.onflyUserId, "google", {
        accessToken: refreshed.access_token,
        refreshToken: connection.refresh_token as string,
        tokenExpiry: newExpiry,
      });
    }

    const body = await request.json();
    const { events } = body as {
      events: Array<{
        title: string;
        start: string;
        end: string;
        description?: string;
        location?: string;
      }>;
    };

    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ error: "events array required" }, { status: 400 });
    }

    const created = await Promise.all(
      events.map((e) =>
        createEvent(accessToken, {
          summary: e.title,
          start: e.start,
          end: e.end,
          description: e.description ?? "Criado pelo OnTime | Onfly",
          location: e.location,
        })
      )
    );

    return NextResponse.json({ data: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Calendar create error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
