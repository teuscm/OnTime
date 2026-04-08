import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <OnboardingWizard />
    </div>
  );
}
