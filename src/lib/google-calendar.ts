const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// ─── OAuth ───────────────────────────────────────────────────

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text}`);
  }

  return res.json();
}

export async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed: ${text}`);
  }

  return res.json();
}

// ─── Calendar Events ─────────────────────────────────────────

interface GoogleEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  attendees?: Array<{ email: string }>;
  recurrence?: string[];
  recurringEventId?: string;
  htmlLink?: string;
}

interface GoogleEventsResponse {
  items: GoogleEvent[];
  nextPageToken?: string;
}

export async function fetchEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleEvent[]> {
  const allEvents: GoogleEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      ...(pageToken ? { pageToken } : {}),
    });

    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar API ${res.status}: ${text}`);
    }

    const data: GoogleEventsResponse = await res.json();
    allEvents.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allEvents;
}

export async function createEvent(
  accessToken: string,
  event: {
    summary: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
  }
): Promise<GoogleEvent> {
  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description ?? "Criado pelo OnTime | Onfly",
      location: event.location,
      start: { dateTime: event.start, timeZone: "America/Sao_Paulo" },
      end: { dateTime: event.end, timeZone: "America/Sao_Paulo" },
      transparency: "opaque", // Marks as Busy
      reminders: { useDefault: true },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar create event failed: ${text}`);
  }

  return res.json();
}
