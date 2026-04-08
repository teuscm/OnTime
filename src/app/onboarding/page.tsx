import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar userName={session.userName} showNav />
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <OnboardingWizard />
      </main>
    </div>
  );
}
