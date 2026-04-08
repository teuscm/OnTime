import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { cookies } from "next/headers";
import { getAuthorizationUrl } from "@/lib/onfly";

export async function GET() {
  const state = uuid();
  const cookieStore = await cookies();

  cookieStore.set("onfly_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  const url = getAuthorizationUrl(state);
  return NextResponse.redirect(url);
}
