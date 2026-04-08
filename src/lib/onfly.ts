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
    name: string;
    stateCode: string;
    countryCode: string;
    placeId: string;
  };
}

export async function searchAirports(
  accessToken: string,
  tokenType: string,
  query: string
): Promise<OnflyAirport[]> {
  const params = new URLSearchParams({ lang: "pt-br", search: query });
  return onFlyRequest({
    url: `${BFF_BASE}/bff/destination/airports?${params.toString()}`,
    token: accessToken,
    tokenType,
    useBffHeaders: true,
  });
}

// ─── Quote-based Flight Search (BFF) ────────────────────────

interface CreateQuoteResponse {
  id: string;
  flightQuotes?: Array<{ id: string }>;
  hotelQuotes?: Array<{ id: string }>;
}

export async function createFlightQuote(
  accessToken: string,
  tokenType: string,
  params: {
    origin: OnflyAirport;
    destination: OnflyAirport;
    departureDate: string;
    returnDate?: string;
  }
): Promise<{ quoteId: string; flightQuoteId: string }> {
  const flights = [
    {
      origin: {
        id: params.origin.id,
        code: params.origin.code,
        name: params.origin.name,
        placeId: params.origin.placeId,
        city: params.origin.city,
        type: "Airport",
      },
      destination: {
        id: params.destination.id,
        code: params.destination.code,
        name: params.destination.name,
        placeId: params.destination.placeId,
        city: params.destination.city,
        type: "Airport",
      },
      departureDate: params.departureDate,
      ...(params.returnDate ? { returnDate: params.returnDate } : {}),
    },
  ];

  const res = await onFlyRequest<CreateQuoteResponse>({
    method: "POST",
    url: `${BFF_BASE}/bff/quote/create`,
    token: accessToken,
    tokenType,
    useBffHeaders: true,
    body: { owners: [null], flights },
  });

  return {
    quoteId: res.id,
    flightQuoteId: res.flightQuotes?.[0]?.id ?? "",
  };
}

export interface FlightResult {
  id: string;
  cheapestPrice: number;
  cheapestTotalPrice: number;
  duration: number;
  from: string;
  to: string;
  fares: Array<{
    family: string;
    businessClass: string;
    ciaManaging: { code: string; name: string };
    totalPrice: number;
    refundable: boolean;
  }>;
  options: {
    outbounds: Array<{
      departure: string;
      arrival: string;
      duration: number;
      flightNumber: number;
      stopsCount: number;
    }>;
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

export async function createHotelQuote(
  accessToken: string,
  tokenType: string,
  params: {
    cityId: string;
    checkIn: string;
    checkOut: string;
  }
): Promise<{ quoteId: string; hotelQuoteId: string }> {
  const res = await onFlyRequest<CreateQuoteResponse>({
    method: "POST",
    url: `${BFF_BASE}/bff/quote/create`,
    token: accessToken,
    tokenType,
    useBffHeaders: true,
    body: {
      owners: [null],
      hotels: [
        {
          checkIn: params.checkIn,
          checkOut: params.checkOut,
          destination: { type: "cityId", value: params.cityId },
          travelers: [{ birthday: "2000-01-01", roomIndex: 0 }],
        },
      ],
    },
  });

  return {
    quoteId: res.id,
    hotelQuoteId: res.hotelQuotes?.[0]?.id ?? "",
  };
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
  neighborhood: string;
  address: string;
  amenities: string[];
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
  return onFlyRequest<HotelSearchResponse>({
    method: "POST",
    url: `${BFF_BASE}/bff/quote/${quoteId}/item`,
    token: accessToken,
    tokenType,
    useBffHeaders: true,
    body: {
      page: 1,
      paginate: true,
      perPage: 10,
      hotelQuote: {
        filters,
        hotelQuoteId,
        sort,
      },
    },
  });
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
