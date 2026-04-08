import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForToken, getUserInfo, getCompanyInfo } from "@/lib/onfly";
import { createSession, setSessionCookie } from "@/lib/auth";
import { getPreferences } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?error=missing_params", request.url));
  }

  // Validate CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("onfly_oauth_state")?.value;
  cookieStore.delete("onfly_oauth_state");

  if (state !== storedState) {
    return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
  }

  try {
    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code);
    const { access_token, token_type } = tokenData;

    // Fetch user info
    const userInfo = await getUserInfo(access_token, token_type);
    const user = userInfo.data;

    // Fetch company info
    const companyInfo = await getCompanyInfo(user.id, access_token, token_type);
    const company = companyInfo.data;

    // Create session
    const sessionToken = await createSession({
      accessToken: access_token,
      tokenType: token_type,
      onflyUserId: String(user.id),
      companyDocument: company.document,
      userName: user.name,
      userEmail: user.email,
    });

    await setSessionCookie(sessionToken);

    // Check if user has completed onboarding
    const prefs = await getPreferences(String(user.id));
    const hasCompletedOnboarding = prefs && (prefs.onboarding_completed as number) === 1;

    const redirectUrl = hasCompletedOnboarding ? "/dashboard" : "/onboarding";
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error) {
    console.error("Onfly OAuth callback error:", error);
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}
