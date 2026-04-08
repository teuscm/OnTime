import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { AuthSession } from "@/types";

const SESSION_COOKIE = "ontime_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

function getSecret() {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("APP_SECRET must be set and at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(session: AuthSession): Promise<string> {
  const token = await new SignJWT({
    accessToken: session.accessToken,
    tokenType: session.tokenType,
    onflyUserId: session.onflyUserId,
    companyDocument: session.companyDocument,
    userName: session.userName,
    userEmail: session.userEmail,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());

  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      accessToken: payload.accessToken as string,
      tokenType: payload.tokenType as string,
      onflyUserId: payload.onflyUserId as string,
      companyDocument: payload.companyDocument as string,
      userName: payload.userName as string,
      userEmail: payload.userEmail as string,
    };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function requireSession(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
