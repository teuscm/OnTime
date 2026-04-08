import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPreferences } from "@/lib/db";
import { LoginPage } from "@/components/LoginPage";

export default async function Home() {
  const session = await getSession();

  if (session) {
    const prefs = await getPreferences(session.onflyUserId);
    const hasOnboarding = prefs && (prefs.onboarding_completed as number) === 1;
    redirect(hasOnboarding ? "/dashboard" : "/onboarding");
  }

  return <LoginPage />;
}
