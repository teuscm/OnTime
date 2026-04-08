import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeGoogleCode } from "@/lib/google-calendar";
import { getSession } from "@/lib/auth";
import { upsertCalendarConnection } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/?error=unauthorized", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/dashboard?error=missing_params", request.url));
  }

  // Validate CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (state !== storedState) {
    return NextResponse.redirect(new URL("/dashboard?error=invalid_state", request.url));
  }

  try {
    const tokens = await exchangeGoogleCode(code);

    const expiryDate = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await upsertCalendarConnection(session.onflyUserId, "google", {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: expiryDate,
    });

    return NextResponse.redirect(new URL("/dashboard?calendar=connected", request.url));
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(new URL("/dashboard?error=google_auth_failed", request.url));
  }
}
