// ─── User & Auth ─────────────────────────────────────────────
export interface OnflyUser {
  id: number;
  email: string;
  name: string;
  isAdmin: boolean;
}

export interface OnflyCompany {
  document: string; // CNPJ — stable identifier
  fantasyName: string;
}

export interface AuthSession {
  accessToken: string;
  tokenType: string;
  onflyUserId: string;
  companyDocument: string;
  userName: string;
  userEmail: string;
}

// ─── Preferences ─────────────────────────────────────────────
export type TransportType = "flight" | "bus";
export type Carrier = "LATAM" | "GOL" | "Azul" | "";
export type ItineraryStyle = "same_day" | "buffer";
export type TimePreference = "morning" | "midday" | "evening";
export type HotelType = "hotel" | "airbnb" | "charlie" | "";
export type MobilityPreference = "rideshare" | "taxi";
export type CalendarProvider = "google" | "outlook";

export interface UserPreferences {
  onflyUserId: string;

  // Step 1: Transporte
  transportType: TransportType;
  preferredCarrier: Carrier;

  // Step 2: Origem & Itinerario
  homeCity: string;
  homeAirport: string;
  homeLat: number | null;
  homeLng: number | null;
  itineraryStyle: ItineraryStyle;
  bufferArriveDayBefore: boolean;
  bufferDepartDayAfter: boolean;
  timePreference: TimePreference;

  // Step 3: Hospedagem
  hotelShareRoom: boolean;
  hotelBreakfastRequired: boolean;
  hotelType: HotelType;

  // Step 4: Mobilidade
  prefersRentalCar: boolean;
  mobilityPreference: MobilityPreference;

  // Step 5: Bleisure
  bleisureEnabled: boolean;
  bleisureWithCompanion: boolean;

  // Meta
  onboardingCompleted: boolean;
}

// ─── Calendar ────────────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO 8601
  end: string;
  location: string | null;
  attendees: string[];
  isRecurring: boolean;
  htmlLink?: string;
}

export interface CalendarConnection {
  onflyUserId: string;
  provider: CalendarProvider;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: string;
  calendarId: string;
}

// ─── Itinerary ───────────────────────────────────────────────
export interface TransportLeg {
  origin: string;
  destination: string;
  suggestedDate: string;
  suggestedTime: string;
  reason: string;
}

export interface TransportSuggestion {
  type: "flight" | "bus";
  outbound: TransportLeg;
  return: TransportLeg;
}

export interface MobilityLeg {
  leg: string;
  type: "uber" | "taxi" | "rental_car";
  time: string;
}

export interface ConflictDetection {
  event: string;
  originalTime: string;
  conflictReason: string;
  suggestion: string;
  alternativeTime: string | null;
}

export interface BleisureSuggestion {
  eligible: boolean;
  reason: string;
  onhappyLink: string;
}

export interface CalendarEventToCreate {
  title: string;
  start: string;
  end: string;
  description?: string;
}

export interface TripItinerary {
  event: {
    title: string;
    datetime: string;
    location: string;
    durationHours: number;
  };
  transport: TransportSuggestion | null;
  hotel: {
    needed: boolean;
    checkIn?: string;
    checkOut?: string;
    preferences?: string;
  } | null;
  mobility: MobilityLeg[];
  conflicts: ConflictDetection[];
  bleisure: BleisureSuggestion | null;
  calendarEventsToCreate: CalendarEventToCreate[];
}

export interface ItineraryResponse {
  trips: TripItinerary[];
}

export type ItineraryStatus = "suggested" | "confirmed" | "booked";

// ─── API Responses ───────────────────────────────────────────
export interface ApiError {
  error: string;
  message: string;
}

export interface ApiSuccess<T> {
  data: T;
}
