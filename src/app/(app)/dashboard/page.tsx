import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCalendarConnection } from "@/lib/db";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const googleConnection = getCalendarConnection(session.onflyUserId, "google");
  const hasGoogleCalendar = !!googleConnection;

  return (
    <div className="p-6 lg:p-10 max-w-[960px] mx-auto">
      <DashboardContent
        hasGoogleCalendar={hasGoogleCalendar}
        userName={session.userName}
      />
    </div>
  );
}
