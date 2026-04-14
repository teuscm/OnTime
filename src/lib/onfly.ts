const BFF_BASE = "https://toguro-app-prod.onfly.com";
const ONFLY_ACCEPT_HEADER = "application/prs.onfly.v1+json";
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

// ─── Env validation ─────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// ─── Generic request with retry ─────────────────────────────

interface OnflyRequestOptions {
  method?: string;
  url: string;
  body?: Record<string, unknown> | string;
  token?: string;
  tokenType?: string;
  contentType?: "json" | "form";
  useBffHeaders?: boolean;
}

async function onFlyRequest<T>(options: OnflyRequestOptions): Promise<T> {
  const {
    method = "GET",
    url,
    body,
    token,
    tokenType = "Bearer",
    contentType = "json",
    useBffHeaders = false,
  } = options;

  const headers: Record<string, string> = {
    Accept: useBffHeaders ? "application/json" : ONFLY_ACCEPT_HEADER,
  };

  if (token) {
    headers["Authorization"] = `${tokenType} ${token}`;
  }

  let requestBody: string | undefined;
  if (body) {
    if (contentType === "form") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      requestBody = new URLSearchParams(body as Record<string, string>).toString();
    } else {
      headers["Content-Type"] = "application/json";
      requestBody = typeof body === "string" ? body : JSON.stringify(body);
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: requestBody,
      });

      if (res.status === 429) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        console.error(`[ONFLY] ${method} ${url} → ${res.status}:`, text.substring(0, 500));
        throw new Error(`Onfly API ${res.status}: ${text}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRIES - 1) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  throw lastError ?? new Error("Onfly API request failed");
}

// ─── Internal BFF Token ─────────────────────────────────────

interface InternalTokenResponse {
  token: string;
  refreshToken: string;
}

let bffTokenCache: { token: string; expiresAt: number } | null = null;

export async function getInternalBffToken(
  accessToken: string,
  tokenType: string
): Promise<string> {
  // Return cached token if still valid (with 60s margin)
  if (bffTokenCache && bffTokenCache.expiresAt > Date.now() + 60_000) {
    console.log("[ONFLY] BFF token: cache hit (expires in " + Math.round((bffTokenCache.expiresAt - Date.now()) / 1000) + "s)");
    return bffTokenCache.token;
  }

  console.log("[ONFLY] BFF token: fetching internal token from api.onfly.com/auth/token/internal...");
  const t0 = Date.now();
  const res = await onFlyRequest<InternalTokenResponse>({
    url: "https://api.onfly.com/auth/token/internal",
    token: accessToken,
    tokenType,
  });

  // Parse JWT to get expiration (without verification — we just need the exp claim)
  let expiresAt = Date.now() + 14 * 60 * 1000; // fallback: 14 min
  try {
    const payload = JSON.parse(atob(res.token.split(".")[1]));
    if (payload.exp) {
      expiresAt = payload.exp * 1000;
    }
    console.log(`[ONFLY] BFF token: OK in ${Date.now() - t0}ms, expires at ${new Date(expiresAt).toISOString()}, user_id=${payload.user_id}`);
  } catch {
    console.log(`[ONFLY] BFF token: OK in ${Date.now() - t0}ms (could not parse exp, using 14min fallback)`);
  }

  bffTokenCache = { token: res.token, expiresAt };
  return res.token;
}

// ─── Auth ────────────────────────────────────────────────────

export function getAuthorizationUrl(state: string): string {
  const clientId = requireEnv("ONFLY_CLIENT_ID");
  const redirectUri = requireEnv("ONFLY_REDIRECT_URI");
  const baseUrl = requireEnv("ONFLY_AUTH_BASE_URL");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });

  // Onfly uses hash-based SPA routing — params go inside the fragment
  return `${baseUrl}#/auth/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; token_type: string }> {
  return onFlyRequest({
    method: "POST",
    url: requireEnv("ONFLY_TOKEN_URL"),
    contentType: "form",
    body: {
      grant_type: "authorization_code",
      code,
      redirect_uri: requireEnv("ONFLY_REDIRECT_URI"),
      client_id: requireEnv("ONFLY_CLIENT_ID"),
      client_secret: requireEnv("ONFLY_CLIENT_SECRET"),
    },
  });
}

// ─── User Info ───────────────────────────────────────────────

interface OnflyUserResponse {
  data: {
    id: number;
    email: string;
    name: string;
    permissions: { data: { id: number } };
  };
}

export async function getUserInfo(accessToken: string, tokenType: string): Promise<OnflyUserResponse> {
  return onFlyRequest({
    url: `${requireEnv("ONFLY_USER_INFO_URL")}?include=permissions`,
    token: accessToken,
    tokenType,
  });
}

interface OnflyCompanyResponse {
  data: {
    document: string;
    fantasyName: string;
  };
}

export async function getCompanyInfo(
  userId: number,
  accessToken: string,
  tokenType: string
): Promise<OnflyCompanyResponse> {
  return onFlyRequest({
    url: `${requireEnv("ONFLY_COMPANY_URL")}/${userId}/company?include=plan.modules.options,logo,permissions,employeesCount,settingsLocale`,
    token: accessToken,
    tokenType,
  });
}

// ─── Airport Autocomplete (BFF) ─────────────────────────────

export interface OnflyAirport {
  id: string;
  code: string;
  name: string;
  placeId: string;
  city: {
    id: string;
    name: string;
    stateCode: string;
    countryCode: string;
    placeId: string;
    [key: string]: unknown; // autocomplete returns extra fields
  };
}

// ─── POI Autocomplete (for hotel proximity search) ──────────

interface PoiAutocompleteResponse {
  data: {
    cities: unknown[];
    pointsOfInterest: Array<{
      description: string;
      place_id: string;
      structured_formatting: { main_text: string; secondary_text: string };
    }>;
  };
}

export async function searchPoi(
  accessToken: string,
  tokenType: string,
  query: string
): Promise<{ placeId: string; description: string } | null> {
  const params = new URLSearchParams({ lang: "pt-br", search: query });
  console.log(`[ONFLY] searchPoi("${query}")...`);
  const t0 = Date.now();

  const res = await onFlyRequest<PoiAutocompleteResponse>({
    url: `${BFF_BASE}/bff/destination/cities/autocomplete?${params.toString()}`,
    token: accessToken,
    tokenType,
    useBffHeaders: true,
  });

  const poi = res.data?.pointsOfInterest?.[0];
  if (poi) {
    console.log(`[ONFLY] searchPoi: found "${poi.structured_formatting.main_text}" (placeId=${poi.place_id}) in ${Date.now() - t0}ms`);
    return { placeId: poi.place_id, description: poi.description };
  }

  console.warn(`[ONFLY] searchPoi: no POI found for "${query}" in ${Date.now() - t0}ms`);
  return null;
}

// ─── Airport Autocomplete (BFF) ─────────────────────────────

export async function searchAirports(
  accessToken: string,
  tokenType: string,
  query: string
): Promise<OnflyAirport[]> {
  const params = new URLSearchParams({ lang: "pt-br", search: query });
  const raw = await onFlyRequest<unknown>({
    url: `${BFF_BASE}/bff/destination/airports?${params.toString()}`,
    token: accessToken,
    tokenType,
    useBffHeaders: true,
  });

  console.log(`[ONFLY] searchAirports("${query}") raw response type=${typeof raw}, isArray=${Array.isArray(raw)}, keys=${typeof raw === "object" && raw !== null ? Object.keys(raw as Record<string, unknown>).join(",") : "n/a"}`);

  // Handle both { data: [...] } and direct array responses
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && raw !== null && "data" in (raw as Record<string, unknown>)) {
    const data = (raw as Record<string, unknown>).data;
    if (Array.isArray(data)) return data;
  }

  console.warn(`[ONFLY] searchAirports("${query}") unexpected response shape:`, JSON.stringify(raw).substring(0, 500));
  return [];
}

// ─── Quote-based Flight Search (BFF) ────────────────────────

interface CreateQuoteResponse {
  id: string;
  flightQuotes?: Array<{ id: string }>;
  hotelQuotes?: Array<{ id: string }>;
}

// Real Onfly BFF format: single request creates quote + returns search results
export interface FlightQuoteResponse {
  id: string; // quoteId
  item: {
    id: string; // flightQuoteId
    type: string;
    from: string;
    to: string;
    departure: string;
    return?: string;
    status: string;
    travelers: Array<{ id: string; birthday: string }>;
  };
  response: {
    data: FlightResult[];
  };
}

export async function createAndSearchFlights(
  accessToken: string,
  tokenType: string,
  params: {
    from: string;     // IATA code (e.g. "CNF")
    to: string;       // IATA code or city code (e.g. "SAO", "REC")
    departure: string; // YYYY-MM-DD
    returnDate?: string; // YYYY-MM-DD
  }
): Promise<FlightQuoteResponse[]> {
  const requestBody = {
    owners: [null],
    flights: [
      {
        from: params.from,
        to: params.to,
        departure: params.departure,
        ...(params.returnDate ? { return: params.returnDate } : {}),
        travelers: 1,
      },
    ],
    groupFlights: true,
  };

  console.log(`[ONFLY] createAndSearchFlights body:`, JSON.stringify(requestBody));

  const res = await onFlyRequest<FlightQuoteResponse[]>({
    method: "POST",
    url: `${BFF_BASE}/bff/quote/create`,
    token: accessToken,
    tokenType,
    useBffHeaders: true,
    body: requestBody,
  });

  console.log(`[ONFLY] createAndSearchFlights: got ${Array.isArray(res) ? res.length : 0} quote(s), first quoteId=${res?.[0]?.id ?? "none"}, flights=${res?.[0]?.response?.data?.length ?? 0}`);
  return res;
}

export interface FlightOptionDetail {
  id: string;
  departure: string;
  arrival: string;
  duration: number;
  flightNumber: number;
  stopsCount: number;
  ciaManaging: { code: string; name: string; imageUrl?: string };
  ciaOperating: { code: string; name: string; imageUrl?: string };
  from: { code: string; name: string };
  to: { code: string; name: string };
}

export interface FlightResult {
  id: string;
  cheapestPrice: number;
  cheapestTotalPrice: number;
  hasAgreement: boolean;
  fares: Array<{
    id: string;
    family: string;
    businessClass: string;
    ciaManaging: { code: string; name: string; imageUrl?: string };
    totalPrice: number;
    refundable: boolean;
    from: string;
    to: string;
  }>;
  options: {
    outbounds: FlightOptionDetail[];
    inbounds?: FlightOptionDetail[];
  };
}

interface FlightSearchResponse {
  data: FlightResult[];
  meta?: { total: number; currentPage: number; lastPage: number };
}

export async function searchFlights(
  accessToken: string,
  tokenType: string,
  quoteId: string,
  flightQuoteId: string,
  filters: Record<string, unknown> = {},
  sort: { key: string; order: string } = { key: "cheapestTotalPrice", order: "asc" }
): Promise<FlightSearchResponse> {
  return onFlyRequest<FlightSearchResponse>({
    method: "POST",
    url: `${BFF_BASE}/bff/quote/${quoteId}/item`,
    token: accessToken,
    tokenType,
    useBffHeaders: true,
    body: {
      page: 1,
      paginate: true,
      perPage: 10,
      flightQuote: {
        bound: "outbound",
        filters,
        flightQuoteId,
        groupFlights: true,
        roundTripType: "twoOneWay",
        sort,
      },
    },
  });
}

// ─── Quote-based Hotel Search (BFF) ─────────────────────────

// Real Onfly BFF format: single request creates quote + returns hotel results
export interface HotelQuoteResponse {
  id: string; // quoteId
  item: {
    id: string;
    type: string;
    checkIn: string;
    checkOut: string;
    status: string;
    nights: number;
  };
  response: {
    data: HotelResult[];
  };
}

export async function createAndSearchHotels(
  accessToken: string,
  tokenType: string,
  params: {
    placeId: string;    // Google Place ID of the city
    checkIn: string;    // YYYY-MM-DD
    checkOut: string;   // YYYY-MM-DD
  }
): Promise<HotelQuoteResponse[]> {
  const requestBody = {
    owners: [null],
    hotels: [
      {
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        destination: { type: "placeId", value: params.placeId },
        travelers: [{ birthday: "2000-01-01", roomIndex: 0 }],
      },
    ],
  };

  console.log(`[ONFLY] createAndSearchHotels body:`, JSON.stringify(requestBody));

  const res = await onFlyRequest<HotelQuoteResponse[]>({
    method: "POST",
    url: `${BFF_BASE}/bff/quote/create`,
    token: accessToken,
    tokenType,
    useBffHeaders: true,
    body: requestBody,
  });

  console.log(`[ONFLY] createAndSearchHotels: got ${Array.isArray(res) ? res.length : 0} quote(s), first quoteId=${res?.[0]?.id ?? "none"}, hotels=${res?.[0]?.response?.data?.length ?? 0}`);
  return res;
}

export interface HotelResult {
  id: string;
  name: string;
  stars: number;
  cheapestPrice: number;
  cheapestDailyPrice: number;
  breakfast: boolean;
  refundable: boolean;
  agreement: boolean;
  coordinates: { lat: number; lng: number };
  thumb: string;
  neighborhood?: string;
  address: { street: string; number: string; district: string; addressLine: string };
  amenities: Array<{ code: string; label: string }>;
  score: number | null;
}

interface HotelSearchResponse {
  data: HotelResult[];
  meta?: { total: number; currentPage: number; lastPage: number };
}

export async function searchHotels(
  accessToken: string,
  tokenType: string,
  quoteId: string,
  hotelQuoteId: string,
  filters: Record<string, unknown> = {},
  sort: { key: string; order: string } = { key: "cheapestPrice", order: "asc" }
): Promise<HotelSearchResponse> {
  const requestBody = {
    page: 1,
    paginate: true,
    perPage: 20,
    hotelQuote: {
      filters,
      hotelQuoteId,
      sort,
    },
  };
  console.log(`[ONFLY] searchHotels body:`, JSON.stringify(requestBody));
  // The /item endpoint returns same structure as /create: { id, item, response: { data: [...] } }
  const raw = await onFlyRequest<unknown>({
    method: "POST",
    url: `${BFF_BASE}/bff/quote/${quoteId}/item`,
    token: accessToken,
    tokenType,
    useBffHeaders: true,
    body: requestBody,
  });

  // Extract hotel data from the nested response
  let hotelData: HotelResult[] = [];
  const rawObj = raw as Record<string, unknown>;
  if (rawObj.response && typeof rawObj.response === "object") {
    const resp = rawObj.response as Record<string, unknown>;
    if (Array.isArray(resp.data)) {
      hotelData = resp.data;
    }
  } else if (Array.isArray(rawObj.data)) {
    hotelData = rawObj.data;
  }

  console.log(`[ONFLY] searchHotels: extracted ${hotelData.length} hotels`);
  return { data: hotelData };
}

// ─── Deep Link Generation ───────────────────────────────────

export function generateFlightDeepLink(
  origin: OnflyAirport,
  destination: OnflyAirport,
  outboundDate: string
): string {
  const originObj = {
    city: origin.city,
    code: origin.code,
    displayName: null,
    id: origin.id,
    name: origin.name,
    placeId: origin.placeId,
    type: "Airport",
  };

  const destObj = {
    city: destination.city,
    code: destination.code,
    displayName: null,
    id: destination.id,
    name: destination.name,
    placeId: destination.placeId,
    type: "Airport",
  };

  const params = new URLSearchParams({
    type: "flights",
    origin: JSON.stringify(originObj),
    destination: JSON.stringify(destObj),
    outboundDate,
    passengers: "[]",
    selectedTravellers: "[]",
  });

  return `https://app.onfly.com/travel/#/travel/booking/search?${params.toString()}`;
}

export function generateHotelDeepLink(
  city: { id: string; name: string; placeId: string; city: { countryCode: string; name: string; stateCode: string } },
  fromDate: string,
  toDate: string
): string {
  const cityObj = {
    city: city.city,
    id: city.id,
    isCity: true,
    name: city.name,
    placeId: city.placeId,
    firstCity: true,
  };

  const params = new URLSearchParams({
    type: "hotels",
    city: JSON.stringify(cityObj),
    fromDate,
    toDate,
    rooms: JSON.stringify([{ guestsQuantity: 1, travelerIds: [] }]),
    selectedTravellers: "[]",
  });

  return `https://app.onfly.com/travel/#/travel/booking/search?${params.toString()}`;
}

export function generateOnHappyLink(
  cityName: string,
  checkin: string,
  checkout: string
): string {
  const params = new URLSearchParams({
    guests: "18,18",
    checkin,
    checkout,
    description: cityName,
    type: "user",
  });

  return `https://app.onhappy.com.br/hotel-search?${params.toString()}`;
}
