import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { cookies } from "next/headers";
import { getGoogleAuthUrl } from "@/lib/google-calendar";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = uuid();
  const cookieStore = await cookies();

  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  const url = getGoogleAuthUrl(state);
  return NextResponse.redirect(url);
}
