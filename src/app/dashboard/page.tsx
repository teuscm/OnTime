import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPreferences, getCalendarConnection } from "@/lib/db";
import { Navbar } from "@/components/layout/Navbar";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const prefs = getPreferences(session.onflyUserId);
  if (!prefs || (prefs.onboarding_completed as number) !== 1) {
    redirect("/onboarding");
  }

  const googleConnection = getCalendarConnection(session.onflyUserId, "google");
  const hasGoogleCalendar = !!googleConnection;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar userName={session.userName} showNav />
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8">
        <DashboardContent
          hasGoogleCalendar={hasGoogleCalendar}
          userName={session.userName}
        />
      </main>
    </div>
  );
}
