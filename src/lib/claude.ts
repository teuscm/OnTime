import Anthropic from "@anthropic-ai/sdk";
import type { UserPreferences, CalendarEvent, ItineraryResponse, FlightOption, HotelOption } from "@/types";

const client = new Anthropic();

const ITINERARY_SCHEMA = JSON.stringify({
  trips: [
    {
      event: {
        title: "string",
        datetime: "ISO 8601",
        location: "string",
        durationHours: "number",
      },
      transport: {
        type: "flight | bus",
        outbound: {
          origin: "IATA code",
          destination: "IATA code",
          suggestedDate: "YYYY-MM-DD",
          suggestedTime: "HH:MM",
          reason: "string",
        },
        return: {
          origin: "IATA code",
          destination: "IATA code",
          suggestedDate: "YYYY-MM-DD",
          suggestedTime: "HH:MM",
          reason: "string",
        },
      },
      hotel: {
        needed: "boolean",
        checkIn: "YYYY-MM-DD (optional)",
        checkOut: "YYYY-MM-DD (optional)",
        preferences: "string (optional)",
      },
      recommendedFlightOutId: "string — ID of the best outbound flight from onfly_flights_outbound",
      recommendedFlightReturnId: "string — ID of the best return flight from onfly_flights_return",
      recommendedHotelId: "string — ID of the best hotel from onfly_hotels",
      recommendationReason: "string — 1-2 sentences explaining why these were chosen",
      mobility: [
        {
          leg: "string (description of route)",
          type: "uber | taxi | rental_car",
          time: "HH:MM",
        },
      ],
      conflicts: [
        {
          event: "string (conflicting event title)",
          originalTime: "HH:MM-HH:MM",
          conflictReason: "string",
          suggestion: "string",
          alternativeTime: "HH:MM or null",
        },
      ],
      bleisure: {
        eligible: "boolean",
        reason: "string",
        onhappyLink: "URL string",
      },
      calendarEventsToCreate: [
        {
          title: "string (with emoji prefix)",
          start: "ISO 8601",
          end: "ISO 8601",
        },
      ],
    },
  ],
});

// Extract only events within travel windows for conflict detection (token optimization)
function getRelevantConflictEvents(
  travelEvents: CalendarEvent[],
  allEvents: CalendarEvent[]
): CalendarEvent[] {
  const travelWindows: Array<{ start: number; end: number }> = [];

  for (const event of travelEvents) {
    const eventDate = new Date(event.start);
    // Expand window: 1 day before to 1 day after the event
    const windowStart = new Date(eventDate);
    windowStart.setDate(windowStart.getDate() - 1);
    const windowEnd = new Date(event.end);
    windowEnd.setDate(windowEnd.getDate() + 1);
    travelWindows.push({ start: windowStart.getTime(), end: windowEnd.getTime() });
  }

  const travelEventIds = new Set(travelEvents.map((e) => e.id));

  return allEvents.filter((event) => {
    if (travelEventIds.has(event.id)) return false;
    const eventStart = new Date(event.start).getTime();
    return travelWindows.some((w) => eventStart >= w.start && eventStart <= w.end);
  });
}

export interface OnflyDataForClaude {
  eventId: string;
  eventTitle: string;
  flightScenarios: Array<{
    label: string;
    dates: string;
    cheapestPrice: number;
    recommended?: boolean;
    outbound: Array<{ id: string; cia: string; dep: string; dur: number; stops: number; price: number; rec?: boolean }>;
    inbound: Array<{ id: string; cia: string; dep: string; dur: number; stops: number; price: number; rec?: boolean }>;
  }>;
  hotels: Array<{ id: string; name: string; stars: number; price: number; cafe?: boolean; rec?: boolean }>;
}

export async function generateItinerary(
  preferences: UserPreferences,
  events: CalendarEvent[],
  allCalendarEvents: CalendarEvent[],
  onflyData?: OnflyDataForClaude[]
): Promise<ItineraryResponse> {
  const conflictCandidates = getRelevantConflictEvents(events, allCalendarEvents);

  const hasOnflyData = onflyData && onflyData.length > 0;

  const systemPrompt = `You are OnTime, an AI corporate travel planner integrated with Onfly.

Given a traveler's calendar events, personal preferences${hasOnflyData ? ", and REAL flight/hotel search results from Onfly" : ""}, generate an optimized travel itinerary for each trip.

## User Preferences
${JSON.stringify(preferences, null, 2)}

## User Home Location
${preferences.homeCity} (nearest airport: ${preferences.homeAirport})

## Instructions
1. For each event, plan the FULL door-to-door itinerary:
   - Ground transport: home → airport (consider time of day + distance)
   - Flight/bus: based on preference (${preferences.transportType})
   - Ground transport: destination airport/station → meeting location
   - Hotel: only if itinerary style is "buffer" or meeting spans multiple days
   - Return: reverse of above

2. Apply itinerary style:
   - "same_day": same-day round trip
   - "buffer": arrive day before and/or leave day after

3. Preferences:
   - Preferred carrier: ${preferences.preferredCarrier || "any"}
   - Hotel: ${preferences.hotelShareRoom ? "shared room OK" : "single room"}, ${preferences.hotelBreakfastRequired ? "breakfast required" : "breakfast optional"}, type: ${preferences.hotelType || "any"}
   - Mobility: ${preferences.prefersRentalCar ? "rental car preferred" : `${preferences.mobilityPreference} preferred`}
   - Time preference: ${preferences.timePreference}

${hasOnflyData ? `4. **CRITICAL — Pick from REAL Onfly data:**
   The data includes MULTIPLE flight scenarios (e.g., "Bate-volta", "Com buffer", "Bleisure (volta domingo)") with real prices. You must:

   a) **Pick the BEST SCENARIO** — Compare total costs across scenarios. Consider:
      - Flight price differences between scenarios
      - Hotel cost (if buffer/bleisure adds nights)
      - Whether bleisure saves money on the flight (weekend return is often cheaper)
      - User's preference for buffer style: "${preferences.itineraryStyle}"

   b) **Pick the best FLIGHT within the chosen scenario:**
      - The user prefers "${preferences.preferredCarrier || "any"}". ALWAYS pick ${preferences.preferredCarrier || "any"} UNLESS cheapest overall is >15% cheaper.
      - Among preferred carrier: pick ${preferences.timePreference} departures, then cheaper, then shorter.
      - Set recommendedFlightOutId and recommendedFlightReturnId to IDs from the chosen scenario.

   c) **Pick the best HOTEL:**
      ${preferences.hotelBreakfastRequired ? "Breakfast included is MANDATORY." : "Breakfast is optional."} Prefer corporate agreement, then 3-4 stars, then cheapest.
      Hotel covers ONLY corporate nights (not bleisure weekend — weekend uses OnHappy).

   d) **Explain in recommendationReason** (2-3 sentences in Portuguese):
      - Which scenario you chose and why
      - Price comparison between scenarios ("Bate-volta R$X vs Buffer R$Y vs Bleisure R$Z")
      - If bleisure is cheapest, mention the OnHappy opportunity for the weekend

   - Use the ACTUAL departure/arrival times from the recommended flight for the transport section` : ""}

5. Detect conflicts with other calendar events during travel time.
   For each conflict suggest ONE of:
   - "Participar remoto" (if meeting can be remote)
   - "Mover para [novo horário]" (suggest specific alternative)

6. Bleisure: if user opted in (${preferences.bleisureEnabled}) AND trip touches Thu/Fri/weekend,
   flag as eligible with OnHappy link:
   https://app.onhappy.com.br/hotel-search?guests=18,18&checkin={date}&checkout={date}&description={city}&type=user

7. Calendar events to create: each leg with emoji prefix (🚗 🚌 ✈️ 🏨), ISO 8601 datetimes

Respond ONLY with valid JSON. No markdown. No explanation.
Schema: ${ITINERARY_SCHEMA}`;

  let userMessage = `## Travel-worthy events to plan
${JSON.stringify(events, null, 2)}

## Other calendar events during travel periods (for conflict detection)
${JSON.stringify(conflictCandidates, null, 2)}`;

  if (hasOnflyData) {
    userMessage += `\n\n## REAL Onfly search results (use these to pick recommendations)
${JSON.stringify(onflyData, null, 2)}`;
  }

  userMessage += `\n\nGenerate the complete itinerary for each travel-worthy event.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: userMessage }],
    system: systemPrompt,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Strip markdown code blocks if Claude wraps the JSON
  let raw = textBlock.text.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  return JSON.parse(raw) as ItineraryResponse;
}

export async function filterTravelEvents(
  events: CalendarEvent[],
  homeCity: string
): Promise<CalendarEvent[]> {
  if (events.length === 0) return [];

  // Send minimal event data to reduce token usage
  const minimalEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    location: e.location,
    isRecurring: e.isRecurring,
  }));

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `You are a calendar event analyzer. Given a list of calendar events and a user's home city, identify which events require travel (the event location is in a different city from the user's home).

Rules:
- ONLY include events whose location is a physical address or city DIFFERENT from the user's home city, requiring intercity travel (plane, bus, or long drive)
- IGNORE meeting rooms, conference rooms, office rooms (e.g. "Sala 1", "Sala Azul", "Room A", "Auditório", "Sala de Reunião", "Escritório", floor numbers, building names within the same city)
- IGNORE virtual/online meetings (Zoom, Meet, Teams, Google Meet links, any URL)
- IGNORE events without a location
- IGNORE recurring daily events (standups, dailies, 1:1s) unless they explicitly mention a different city
- IGNORE events at the company's own office or headquarters (same city as home)
- A location like "Av. Paulista, São Paulo" is only travel-worthy if the user lives in a DIFFERENT city
- When in doubt, do NOT include — false negatives are better than false positives
- Return ONLY the array of event IDs that require travel

Respond with a JSON array of event ID strings. No markdown. No explanation. Empty array [] if no travel is needed.`,
    messages: [
      {
        role: "user",
        content: `Home city: ${homeCity}\n\nCalendar events:\n${JSON.stringify(minimalEvents, null, 2)}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  const travelEventIds: string[] = JSON.parse(textBlock.text);
  return events.filter((e) => travelEventIds.includes(e.id));
}
