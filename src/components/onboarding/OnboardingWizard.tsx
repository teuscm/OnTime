"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Plane,
  Bus,
  MapPin,
  Hotel,
  Car,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
} from "lucide-react";

const STEPS = [
  { title: "Transporte", description: "Como voce prefere viajar?" },
  { title: "Origem & Itinerario", description: "De onde voce sai e como gosta de planejar?" },
  { title: "Hospedagem", description: "Suas preferencias de hospedagem." },
  { title: "Mobilidade", description: "Como voce se desloca no destino?" },
  { title: "Bleisure", description: "Quer aproveitar viagens com lazer?" },
];

const CARRIERS = ["LATAM", "GOL", "Azul"] as const;
const HOTEL_TYPES = [
  { value: "hotel", label: "Hotel tradicional" },
  { value: "airbnb", label: "Airbnb" },
  { value: "charlie", label: "Charlie" },
  { value: "", label: "Indiferente" },
];

interface Prefs {
  transportType: "flight" | "bus";
  preferredCarrier: string;
  homeCity: string;
  homeAirport: string;
  homeLat: number | null;
  homeLng: number | null;
  itineraryStyle: "same_day" | "buffer";
  bufferArriveDayBefore: boolean;
  bufferDepartDayAfter: boolean;
  timePreference: "morning" | "midday" | "evening";
  hotelShareRoom: boolean;
  hotelBreakfastRequired: boolean;
  hotelType: string;
  prefersRentalCar: boolean;
  mobilityPreference: "rideshare" | "taxi";
  bleisureEnabled: boolean;
  bleisureWithCompanion: boolean;
}

function ToggleOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-[var(--radius-md)] border p-4 text-left transition-all cursor-pointer ${
        selected
          ? "border-onfly/50 bg-onfly/5 text-foreground"
          : "border-border bg-card text-muted hover:border-border-hover"
      }`}
    >
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
          selected ? "border-onfly bg-onfly" : "border-border"
        }`}
      >
        {selected && <Check className="h-3 w-3 text-white" />}
      </div>
      {children}
    </button>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({
    transportType: "flight",
    preferredCarrier: "",
    homeCity: "",
    homeAirport: "",
    homeLat: null,
    homeLng: null,
    itineraryStyle: "buffer",
    bufferArriveDayBefore: true,
    bufferDepartDayAfter: false,
    timePreference: "morning",
    hotelShareRoom: false,
    hotelBreakfastRequired: true,
    hotelType: "",
    prefersRentalCar: false,
    mobilityPreference: "rideshare",
    bleisureEnabled: false,
    bleisureWithCompanion: false,
  });

  const update = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update("homeLat", pos.coords.latitude);
        update("homeLng", pos.coords.longitude);
      },
      () => {}
    );
  };

  const next = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const prev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...prefs, onboardingCompleted: true }),
      });
      if (!res.ok) {
        throw new Error("Erro ao salvar preferencias");
      }
      router.push("/dashboard");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro desconhecido");
      setSaving(false);
    }
  };

  const isLast = currentStep === STEPS.length - 1;

  return (
    <Card className="w-full max-w-xl">
      {/* Progress */}
      <div className="flex gap-1.5 px-6 pt-6">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= currentStep ? "gradient-onfly" : "bg-border"
            }`}
          />
        ))}
      </div>

      <CardHeader className="px-6 pt-4">
        <p className="text-xs text-muted uppercase tracking-wider">
          Passo {currentStep + 1} de {STEPS.length}
        </p>
        <CardTitle className="text-xl">{STEPS[currentStep].title}</CardTitle>
        <CardDescription>{STEPS[currentStep].description}</CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-6 space-y-4">
        {saveError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
            {saveError}
          </div>
        )}

        {/* Step 1: Transport */}
        {currentStep === 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <ToggleOption
                selected={prefs.transportType === "flight"}
                onClick={() => update("transportType", "flight")}
              >
                <Plane className="h-5 w-5" />
                <span>Aereo</span>
              </ToggleOption>
              <ToggleOption
                selected={prefs.transportType === "bus"}
                onClick={() => update("transportType", "bus")}
              >
                <Bus className="h-5 w-5" />
                <span>Onibus</span>
              </ToggleOption>
            </div>

            <div>
              <label className="text-sm text-muted mb-2 block">
                {prefs.transportType === "flight" ? "Cia aerea preferida" : "Viacao preferida"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CARRIERS.map((c) => (
                  <ToggleOption
                    key={c}
                    selected={prefs.preferredCarrier === c}
                    onClick={() => update("preferredCarrier", c)}
                  >
                    <span className="text-sm">{c}</span>
                  </ToggleOption>
                ))}
                <ToggleOption
                  selected={prefs.preferredCarrier === ""}
                  onClick={() => update("preferredCarrier", "")}
                >
                  <span className="text-sm">Indiferente</span>
                </ToggleOption>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Origin & Itinerary */}
        {currentStep === 1 && (
          <>
            <div>
              <label className="text-sm text-muted mb-2 block">Sua cidade base</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prefs.homeCity}
                  onChange={(e) => update("homeCity", e.target.value)}
                  placeholder="Ex: Belo Horizonte"
                  className="flex-1 h-10 rounded-[var(--radius-sm)] border border-border bg-card px-3 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-onfly/40"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={detectLocation}
                  className="shrink-0"
                >
                  <MapPin className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm text-muted mb-2 block">Aeroporto mais proximo</label>
              <input
                type="text"
                value={prefs.homeAirport}
                onChange={(e) => update("homeAirport", e.target.value.toUpperCase())}
                placeholder="Ex: CNF"
                maxLength={3}
                className="w-24 h-10 rounded-[var(--radius-sm)] border border-border bg-card px-3 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-onfly/40 uppercase"
              />
            </div>

            <div>
              <label className="text-sm text-muted mb-2 block">Estilo de itinerario</label>
              <div className="grid grid-cols-2 gap-3">
                <ToggleOption
                  selected={prefs.itineraryStyle === "same_day"}
                  onClick={() => update("itineraryStyle", "same_day")}
                >
                  <span className="text-sm">Bate-volta</span>
                </ToggleOption>
                <ToggleOption
                  selected={prefs.itineraryStyle === "buffer"}
                  onClick={() => update("itineraryStyle", "buffer")}
                >
                  <span className="text-sm">Com buffer</span>
                </ToggleOption>
              </div>
            </div>

            {prefs.itineraryStyle === "buffer" && (
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={prefs.bufferArriveDayBefore}
                    onChange={(e) => update("bufferArriveDayBefore", e.target.checked)}
                    className="accent-onfly"
                  />
                  Chegar dia antes
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={prefs.bufferDepartDayAfter}
                    onChange={(e) => update("bufferDepartDayAfter", e.target.checked)}
                    className="accent-onfly"
                  />
                  Sair dia depois
                </label>
              </div>
            )}

            <div>
              <label className="text-sm text-muted mb-2 block">Horario preferido</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "morning" as const, label: "Manha cedo" },
                  { value: "midday" as const, label: "Meio do dia" },
                  { value: "evening" as const, label: "Noite" },
                ].map((opt) => (
                  <ToggleOption
                    key={opt.value}
                    selected={prefs.timePreference === opt.value}
                    onClick={() => update("timePreference", opt.value)}
                  >
                    <span className="text-sm">{opt.label}</span>
                  </ToggleOption>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step 3: Hotel */}
        {currentStep === 2 && (
          <>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm">Divide quarto?</span>
                <button
                  type="button"
                  onClick={() => update("hotelShareRoom", !prefs.hotelShareRoom)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    prefs.hotelShareRoom ? "bg-onfly" : "bg-border"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      prefs.hotelShareRoom ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between">
                <span className="text-sm">Cafe da manha obrigatorio?</span>
                <button
                  type="button"
                  onClick={() => update("hotelBreakfastRequired", !prefs.hotelBreakfastRequired)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    prefs.hotelBreakfastRequired ? "bg-onfly" : "bg-border"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      prefs.hotelBreakfastRequired ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
            </div>

            <div>
              <label className="text-sm text-muted mb-2 block">Tipo de hospedagem</label>
              <div className="grid grid-cols-2 gap-2">
                {HOTEL_TYPES.map((opt) => (
                  <ToggleOption
                    key={opt.value}
                    selected={prefs.hotelType === opt.value}
                    onClick={() => update("hotelType", opt.value)}
                  >
                    <Hotel className="h-4 w-4" />
                    <span className="text-sm">{opt.label}</span>
                  </ToggleOption>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step 4: Mobility */}
        {currentStep === 3 && (
          <>
            <label className="flex items-center justify-between">
              <span className="text-sm">Dirige e prefere alugar carro?</span>
              <button
                type="button"
                onClick={() => update("prefersRentalCar", !prefs.prefersRentalCar)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  prefs.prefersRentalCar ? "bg-onfly" : "bg-border"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    prefs.prefersRentalCar ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>

            {!prefs.prefersRentalCar && (
              <div>
                <label className="text-sm text-muted mb-2 block">Preferencia de transporte</label>
                <div className="grid grid-cols-2 gap-3">
                  <ToggleOption
                    selected={prefs.mobilityPreference === "rideshare"}
                    onClick={() => update("mobilityPreference", "rideshare")}
                  >
                    <Car className="h-5 w-5" />
                    <span className="text-sm">App (Uber/99)</span>
                  </ToggleOption>
                  <ToggleOption
                    selected={prefs.mobilityPreference === "taxi"}
                    onClick={() => update("mobilityPreference", "taxi")}
                  >
                    <Car className="h-5 w-5" />
                    <span className="text-sm">Taxi</span>
                  </ToggleOption>
                </div>
              </div>
            )}
          </>
        )}

        {/* Step 5: Bleisure */}
        {currentStep === 4 && (
          <>
            <div className="rounded-lg gradient-onhappy-soft border border-onhappy/20 p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-onhappy" />
                <span className="font-medium">OnHappy</span>
              </div>
              <p className="text-sm text-muted">
                Receba sugestoes para estender viagens de trabalho com lazer no fim de semana.
              </p>
            </div>

            <label className="flex items-center justify-between">
              <span className="text-sm">Ativar sugestoes bleisure?</span>
              <button
                type="button"
                onClick={() => update("bleisureEnabled", !prefs.bleisureEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  prefs.bleisureEnabled ? "bg-onhappy" : "bg-border"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    prefs.bleisureEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>

            {prefs.bleisureEnabled && (
              <label className="flex items-center justify-between">
                <span className="text-sm">Viaja com acompanhante?</span>
                <button
                  type="button"
                  onClick={() => update("bleisureWithCompanion", !prefs.bleisureWithCompanion)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    prefs.bleisureWithCompanion ? "bg-onhappy" : "bg-border"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      prefs.bleisureWithCompanion ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
            )}
          </>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="ghost"
            onClick={prev}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>

          {isLast ? (
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  Comecar
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={next}>
              Proximo
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
