import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPreferences } from "@/lib/db";
import { AppShell } from "@/components/app/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const prefs = await getPreferences(session.onflyUserId);
  if (!prefs || (prefs.onboarding_completed as number) !== 1) {
    redirect("/onboarding");
  }

  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      {children}
    </AppShell>
  );
}
