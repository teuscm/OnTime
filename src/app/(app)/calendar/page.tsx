import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCalendarConnection } from "@/lib/db";
import { CalendarContent } from "@/components/calendar/CalendarContent";

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const googleConnection = getCalendarConnection(session.onflyUserId, "google");

  return (
    <div className="p-6 lg:p-10 max-w-[960px] mx-auto">
      <CalendarContent hasGoogleCalendar={!!googleConnection} />
    </div>
  );
}
