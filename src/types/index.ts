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

  // Hotel search defaults
  hotelMaxDailyPrice: number;  // centavos (default 500000 = R$5.000)
  hotelMaxDistance: number;     // meters (default 2000 = 2km)

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
  recommendedFlightOutId?: string;
  recommendedFlightReturnId?: string;
  recommendedHotelId?: string;
  recommendationReason?: string;
  mobility: MobilityLeg[];
  conflicts: ConflictDetection[];
  bleisure: BleisureSuggestion | null;
  calendarEventsToCreate: CalendarEventToCreate[];
}

export interface ItineraryResponse {
  trips: TripItinerary[];
}

export type ItineraryStatus = "suggested" | "confirmed" | "booked";

// ─── Onfly Enrichment ───────────────────────────────────────

export interface ResolvedAirport {
  id: string;
  code: string;
  name: string;
  placeId: string;
  city: {
    name: string;
    stateCode: string;
    countryCode: string;
    placeId: string;
  };
}

export interface FlightOption {
  id: string;
  airline: { code: string; name: string };
  from: string;      // IATA airport code (e.g. "CNF")
  to: string;        // IATA airport code (e.g. "GRU", "CGH")
  price: number;
  totalPrice: number;
  duration: number;
  departure: string;
  arrival: string;
  stops: number;
  flightNumber: number;
  fareFamily: string;
  refundable: boolean;
  recommended: boolean;
}

export interface HotelOption {
  id: string;
  name: string;
  stars: number;
  pricePerNight: number;
  totalPrice: number;
  breakfast: boolean;
  refundable: boolean;
  agreement: boolean;
  thumb: string;
  neighborhood: string;
  amenities: string[];
  recommended: boolean;
}

export interface FlightEnrichment {
  origin: ResolvedAirport;
  destination: ResolvedAirport;
  options: FlightOption[];
  quoteId: string;
  checkoutLink: string;
}

export interface FlightScenario {
  label: string;                // "Bate-volta" | "Com buffer"
  departureDate: string;
  returnDate: string;
  outbound: FlightEnrichment | null;
  inbound: FlightEnrichment | null;
  cheapestTotal: number;        // cheapest round-trip price (BRL)
  recommended: boolean;
}

export interface HotelEnrichment {
  recommended: HotelOption[];
  nearPoi: HotelOption[];
  quoteId: string;
  hotelQuoteId?: string;
  checkoutLink: string;
}

export interface EnrichedTripItinerary extends TripItinerary {
  flightOutbound?: FlightEnrichment | null;
  flightReturn?: FlightEnrichment | null;
  flightScenarios?: FlightScenario[];
  hotelResults?: HotelEnrichment | null;
  enrichmentError?: string;
}

// ─── API Responses ───────────────────────────────────────────
export interface ApiError {
  error: string;
  message: string;
}

export interface ApiSuccess<T> {
  data: T;
}
