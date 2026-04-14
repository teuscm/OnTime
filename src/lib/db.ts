import { createClient, type Client } from "@libsql/client";
import type { UserPreferences } from "@/types";

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

let migrated = false;

async function migrate(): Promise<void> {
  if (migrated) return;
  const db = getClient();
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        onfly_user_id TEXT UNIQUE NOT NULL,
        transport_type TEXT DEFAULT 'flight',
        preferred_carrier TEXT DEFAULT '',
        home_city TEXT DEFAULT '',
        home_airport TEXT DEFAULT '',
        home_lat REAL,
        home_lng REAL,
        itinerary_style TEXT DEFAULT 'buffer',
        buffer_arrive_day_before INTEGER DEFAULT 0,
        buffer_depart_day_after INTEGER DEFAULT 0,
        time_preference TEXT DEFAULT 'morning',
        hotel_share_room INTEGER DEFAULT 0,
        hotel_breakfast_required INTEGER DEFAULT 1,
        hotel_type TEXT DEFAULT '',
        prefers_rental_car INTEGER DEFAULT 0,
        mobility_preference TEXT DEFAULT 'rideshare',
        bleisure_enabled INTEGER DEFAULT 0,
        bleisure_with_companion INTEGER DEFAULT 0,
        hotel_max_daily_price INTEGER DEFAULT 500000,
        hotel_max_distance INTEGER DEFAULT 2000,
        onboarding_completed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS calendar_connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        onfly_user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        token_expiry TEXT,
        calendar_id TEXT DEFAULT 'primary',
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(onfly_user_id, provider)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS itineraries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        onfly_user_id TEXT NOT NULL,
        event_id TEXT,
        status TEXT DEFAULT 'suggested',
        itinerary_json TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
  ]);

  // Add columns that may be missing on existing tables
  const alterStatements = [
    "ALTER TABLE user_preferences ADD COLUMN hotel_max_daily_price INTEGER DEFAULT 500000",
    "ALTER TABLE user_preferences ADD COLUMN hotel_max_distance INTEGER DEFAULT 2000",
    "ALTER TABLE itineraries ADD COLUMN calendar_event_ids TEXT DEFAULT '[]'",
  ];
  for (const sql of alterStatements) {
    try {
      await db.execute({ sql, args: [] });
    } catch {
      // Column already exists — ignore
    }
  }

  migrated = true;
}

async function getDb(): Promise<Client> {
  await migrate();
  return getClient();
}

// ─── Allowed columns (SQL injection guard) ──────────────────

const PREFERENCE_COLUMNS = new Set([
  "transport_type",
  "preferred_carrier",
  "home_city",
  "home_airport",
  "home_lat",
  "home_lng",
  "itinerary_style",
  "buffer_arrive_day_before",
  "buffer_depart_day_after",
  "time_preference",
  "hotel_share_room",
  "hotel_breakfast_required",
  "hotel_type",
  "prefers_rental_car",
  "mobility_preference",
  "bleisure_enabled",
  "bleisure_with_companion",
  "hotel_max_daily_price",
  "hotel_max_distance",
  "onboarding_completed",
]);

// ─── DB Row → TypeScript ────────────────────────────────────

export function dbRowToPreferences(row: Record<string, unknown>): UserPreferences {
  return {
    onflyUserId: row.onfly_user_id as string,
    transportType: (row.transport_type as UserPreferences["transportType"]) ?? "flight",
    preferredCarrier: (row.preferred_carrier as UserPreferences["preferredCarrier"]) ?? "",
    homeCity: (row.home_city as string) ?? "",
    homeAirport: (row.home_airport as string) ?? "",
    homeLat: row.home_lat as number | null,
    homeLng: row.home_lng as number | null,
    itineraryStyle: (row.itinerary_style as UserPreferences["itineraryStyle"]) ?? "buffer",
    bufferArriveDayBefore: (row.buffer_arrive_day_before as number) === 1,
    bufferDepartDayAfter: (row.buffer_depart_day_after as number) === 1,
    timePreference: (row.time_preference as UserPreferences["timePreference"]) ?? "morning",
    hotelShareRoom: (row.hotel_share_room as number) === 1,
    hotelBreakfastRequired: (row.hotel_breakfast_required as number) === 1,
    hotelType: (row.hotel_type as UserPreferences["hotelType"]) ?? "",
    prefersRentalCar: (row.prefers_rental_car as number) === 1,
    mobilityPreference: (row.mobility_preference as UserPreferences["mobilityPreference"]) ?? "rideshare",
    bleisureEnabled: (row.bleisure_enabled as number) === 1,
    bleisureWithCompanion: (row.bleisure_with_companion as number) === 1,
    hotelMaxDailyPrice: (row.hotel_max_daily_price as number) ?? 500000,
    hotelMaxDistance: (row.hotel_max_distance as number) ?? 2000,
    onboardingCompleted: (row.onboarding_completed as number) === 1,
  };
}

// ─── Preference Helpers ─────────────────────────────────────

export async function getPreferences(onflyUserId: string) {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM user_preferences WHERE onfly_user_id = ?",
    args: [onflyUserId],
  });
  return result.rows[0] as Record<string, unknown> | undefined;
}

export async function upsertPreferences(onflyUserId: string, prefs: Record<string, unknown>) {
  const db = await getDb();

  const safePrefs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(prefs)) {
    if (PREFERENCE_COLUMNS.has(key)) {
      safePrefs[key] = value;
    }
  }

  const existing = await getPreferences(onflyUserId);

  if (existing) {
    const keys = Object.keys(safePrefs);
    if (keys.length === 0) return;
    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => safePrefs[k] as string | number | null);
    await db.execute({
      sql: `UPDATE user_preferences SET ${setClause}, updated_at = datetime('now') WHERE onfly_user_id = ?`,
      args: [...values, onflyUserId],
    });
  } else {
    const allFields: Record<string, unknown> = { onfly_user_id: onflyUserId, ...safePrefs };
    const keys = Object.keys(allFields);
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((k) => allFields[k] as string | number | null);
    await db.execute({
      sql: `INSERT INTO user_preferences (${keys.join(", ")}) VALUES (${placeholders})`,
      args: values,
    });
  }
}

// ─── Calendar Connection Helpers ────────────────────────────

export async function getCalendarConnection(onflyUserId: string, provider: string) {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM calendar_connections WHERE onfly_user_id = ? AND provider = ?",
    args: [onflyUserId, provider],
  });
  return result.rows[0] as Record<string, unknown> | undefined;
}

export async function upsertCalendarConnection(
  onflyUserId: string,
  provider: string,
  tokens: { accessToken: string; refreshToken: string; tokenExpiry: string }
) {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO calendar_connections (onfly_user_id, provider, access_token, refresh_token, token_expiry)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(onfly_user_id, provider) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       token_expiry = excluded.token_expiry`,
    args: [onflyUserId, provider, tokens.accessToken, tokens.refreshToken, tokens.tokenExpiry],
  });
}

// ─── Itinerary Helpers ──────────────────────────────────────

export async function saveItinerary(onflyUserId: string, eventId: string, itineraryJson: string) {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO itineraries (onfly_user_id, event_id, itinerary_json) VALUES (?, ?, ?)`,
    args: [onflyUserId, eventId, itineraryJson],
  });
}

export async function getItineraries(onflyUserId: string, limit = 50) {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM itineraries WHERE onfly_user_id = ? ORDER BY created_at DESC LIMIT ?",
    args: [onflyUserId, limit],
  });
  return result.rows as Record<string, unknown>[];
}

export async function updateItineraryStatus(id: number, status: string) {
  const db = await getDb();
  await db.execute({
    sql: `UPDATE itineraries SET status = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [status, id],
  });
}

export async function saveItineraryWithCalendarEvents(
  onflyUserId: string,
  eventId: string,
  itineraryJson: string,
  calendarEventIds: string[]
) {
  const db = await getDb();
  const result = await db.execute({
    sql: `INSERT INTO itineraries (onfly_user_id, event_id, itinerary_json, status, calendar_event_ids) VALUES (?, ?, ?, 'confirmed', ?)`,
    args: [onflyUserId, eventId, itineraryJson, JSON.stringify(calendarEventIds)],
  });
  return Number(result.lastInsertRowid);
}

export async function getItineraryCalendarEvents(id: number): Promise<string[]> {
  const db = await getDb();
  const result = await db.execute({ sql: "SELECT calendar_event_ids FROM itineraries WHERE id = ?", args: [id] });
  const row = result.rows[0];
  if (!row) return [];
  try { return JSON.parse(row.calendar_event_ids as string); } catch { return []; }
}

export async function deleteItinerary(id: number) {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM itineraries WHERE id = ?", args: [id] });
}
