import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { UserPreferences } from "@/types";

const isVercel = !!process.env.VERCEL;
const DATA_DIR = isVercel ? "/tmp" : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "ontime.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
  }
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
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

      onboarding_completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS calendar_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      onfly_user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expiry TEXT,
      calendar_id TEXT DEFAULT 'primary',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(onfly_user_id, provider)
    );

    CREATE TABLE IF NOT EXISTS itineraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      onfly_user_id TEXT NOT NULL,
      event_id TEXT,
      status TEXT DEFAULT 'suggested',
      itinerary_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
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
  "onboarding_completed",
]);

// ─── DB Row → TypeScript (shared) ───────────────────────────

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
    onboardingCompleted: (row.onboarding_completed as number) === 1,
  };
}

// ─── Preference Helpers ──────────────────────────────────────

export function getPreferences(onflyUserId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM user_preferences WHERE onfly_user_id = ?").get(onflyUserId) as Record<string, unknown> | undefined;
}

export function upsertPreferences(onflyUserId: string, prefs: Record<string, unknown>) {
  const db = getDb();

  // Filter to allowed columns only (SQL injection guard)
  const safePrefs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(prefs)) {
    if (PREFERENCE_COLUMNS.has(key)) {
      safePrefs[key] = value;
    }
  }

  const existing = getPreferences(onflyUserId);

  if (existing) {
    const fields = Object.keys(safePrefs)
      .map((k) => `${k} = @${k}`)
      .join(", ");
    if (!fields) return;
    db.prepare(
      `UPDATE user_preferences SET ${fields}, updated_at = datetime('now') WHERE onfly_user_id = @onfly_user_id`
    ).run({ ...safePrefs, onfly_user_id: onflyUserId });
  } else {
    const allFields = { onfly_user_id: onflyUserId, ...safePrefs };
    const keys = Object.keys(allFields);
    const placeholders = keys.map((k) => `@${k}`).join(", ");
    db.prepare(
      `INSERT INTO user_preferences (${keys.join(", ")}) VALUES (${placeholders})`
    ).run(allFields);
  }
}

// ─── Calendar Connection Helpers ─────────────────────────────

export function getCalendarConnection(onflyUserId: string, provider: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM calendar_connections WHERE onfly_user_id = ? AND provider = ?")
    .get(onflyUserId, provider) as Record<string, unknown> | undefined;
}

export function upsertCalendarConnection(
  onflyUserId: string,
  provider: string,
  tokens: { accessToken: string; refreshToken: string; tokenExpiry: string }
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO calendar_connections (onfly_user_id, provider, access_token, refresh_token, token_expiry)
     VALUES (@uid, @provider, @access, @refresh, @expiry)
     ON CONFLICT(onfly_user_id, provider) DO UPDATE SET
       access_token = @access,
       refresh_token = @refresh,
       token_expiry = @expiry`
  ).run({
    uid: onflyUserId,
    provider,
    access: tokens.accessToken,
    refresh: tokens.refreshToken,
    expiry: tokens.tokenExpiry,
  });
}

// ─── Itinerary Helpers ───────────────────────────────────────

export function saveItinerary(onflyUserId: string, eventId: string, itineraryJson: string) {
  const db = getDb();
  return db
    .prepare(
      `INSERT INTO itineraries (onfly_user_id, event_id, itinerary_json) VALUES (?, ?, ?)`
    )
    .run(onflyUserId, eventId, itineraryJson);
}

export function getItineraries(onflyUserId: string, limit = 50) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM itineraries WHERE onfly_user_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(onflyUserId, limit) as Record<string, unknown>[];
}

export function updateItineraryStatus(id: number, status: string) {
  const db = getDb();
  db.prepare(
    `UPDATE itineraries SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, id);
}
