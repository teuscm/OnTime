import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPreferences } from "@/lib/db";
import { SettingsContent } from "@/components/settings/SettingsContent";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const prefs = getPreferences(session.onflyUserId);

  return (
    <div className="p-6 lg:p-10 max-w-[960px] mx-auto">
      <SettingsContent initialPrefs={prefs} />
    </div>
  );
}
