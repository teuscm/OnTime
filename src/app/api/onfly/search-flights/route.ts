import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { searchAirports, createFlightQuote, searchFlights } from "@/lib/onfly";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);

    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const departureDate = searchParams.get("departure_date");
    const returnDate = searchParams.get("return_date") ?? undefined;

    if (!origin || !destination || !departureDate) {
      return NextResponse.json(
        { error: "origin, destination, and departure_date are required" },
        { status: 400 }
      );
    }

    // Resolve IATA codes to airport objects
    const [originAirports, destAirports] = await Promise.all([
      searchAirports(session.accessToken, session.tokenType, origin),
      searchAirports(session.accessToken, session.tokenType, destination),
    ]);

    const originAirport = originAirports.find((a) => a.code === origin.toUpperCase());
    const destAirport = destAirports.find((a) => a.code === destination.toUpperCase());

    if (!originAirport || !destAirport) {
      return NextResponse.json(
        { error: "Could not resolve airport codes" },
        { status: 404 }
      );
    }

    // Create quote then search
    const { quoteId, flightQuoteId } = await createFlightQuote(
      session.accessToken,
      session.tokenType,
      { origin: originAirport, destination: destAirport, departureDate, returnDate }
    );

    const results = await searchFlights(
      session.accessToken,
      session.tokenType,
      quoteId,
      flightQuoteId
    );

    return NextResponse.json({
      data: results.data,
      airports: { origin: originAirport, destination: destAirport },
      quoteId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Flight search error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
