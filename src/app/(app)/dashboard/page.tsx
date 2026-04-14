import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCalendarConnection, getPreferences, dbRowToPreferences } from "@/lib/db";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const [googleConnection, prefsRow] = await Promise.all([
    getCalendarConnection(session.onflyUserId, "google"),
    getPreferences(session.onflyUserId),
  ]);

  const hasGoogleCalendar = !!googleConnection;
  const prefs = prefsRow ? dbRowToPreferences(prefsRow) : null;

  return (
    <div className="p-6 lg:p-10 max-w-[960px] mx-auto">
      <DashboardContent
        hasGoogleCalendar={hasGoogleCalendar}
        userName={session.userName}
        homeAirport={prefs?.homeAirport ?? "CNF"}
        itineraryStyle={prefs?.itineraryStyle ?? "buffer"}
        bufferArriveDayBefore={prefs?.bufferArriveDayBefore ?? true}
        bufferDepartDayAfter={prefs?.bufferDepartDayAfter ?? false}
        bleisureEnabled={prefs?.bleisureEnabled ?? false}
        hotelMaxDailyPrice={prefs?.hotelMaxDailyPrice ?? 500000}
        hotelMaxDistance={prefs?.hotelMaxDistance ?? 2000}
      />
    </div>
  );
}
