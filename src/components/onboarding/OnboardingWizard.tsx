"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Plane,
  Bus,
  MapPin,
  Hotel,
  Car,
  Sun,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  Coffee,
  Star,
  Navigation,
} from "lucide-react";

const onlyLogo = "/onfly-new.svg";
const onhappyLogo = "/onhappy_logo.webp";

const STEPS = [
  { title: "Transporte", description: "Como você prefere viajar?", icon: Plane },
  { title: "Origem & Itinerário", description: "De onde você sai e como gosta de planejar?", icon: MapPin },
  { title: "Hospedagem", description: "Suas preferências de hospedagem.", icon: Hotel },
  { title: "Mobilidade", description: "Como você se desloca no destino?", icon: Car },
  { title: "Bleisure", description: "Quer aproveitar viagens com lazer?", icon: Sun },
];

const CARRIERS = ["LATAM", "GOL", "Azul"] as const;
const HOTEL_TYPES = [
  { value: "hotel", label: "Hotel tradicional", icon: Hotel },
  { value: "airbnb", label: "Airbnb", icon: Hotel },
  { value: "charlie", label: "Charlie", icon: Star },
  { value: "", label: "Indiferente", icon: Check },
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

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  const next = () => { if (currentStep < STEPS.length - 1) setCurrentStep((s) => s + 1); };
  const prev = () => { if (currentStep > 0) setCurrentStep((s) => s - 1); };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...prefs, onboardingCompleted: true }),
      });
      if (!res.ok) throw new Error("Erro ao salvar preferências");
      router.push("/dashboard");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro desconhecido");
      setSaving(false);
    }
  };

  const isLast = currentStep === STEPS.length - 1;
  const StepIcon = STEPS[currentStep].icon;

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <img src={onlyLogo} alt="Onfly" className="h-7" />
        <span className="font-semibold text-sm text-primary">OnTime</span>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5 mb-8">
        {STEPS.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-muted">
            <div
              className={cn("h-full rounded-full transition-all duration-500", i <= currentStep ? "gradient-onfly w-full" : "w-0")}
            />
          </div>
        ))}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl gradient-onfly flex items-center justify-center">
          <StepIcon className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Passo {currentStep + 1} de {STEPS.length}
          </p>
          <h2 className="text-xl font-bold">{STEPS[currentStep].title}</h2>
          <p className="text-sm text-muted-foreground">{STEPS[currentStep].description}</p>
        </div>
      </div>

      {saveError && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive-foreground mb-4">
          {saveError}
        </div>
      )}

      {/* Step content */}
      <div className="space-y-4 animate-fade-in">
        {/* Step 1: Transport */}
        {currentStep === 0 && (
          <>
            <div className="flex rounded-xl bg-muted p-1 gap-1">
              <button
                onClick={() => update("transportType", "flight")}
                className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all duration-300", prefs.transportType === "flight" ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}
              >
                <Plane className="w-4 h-4" /> Aéreo
              </button>
              <button
                onClick={() => update("transportType", "bus")}
                className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all duration-300", prefs.transportType === "bus" ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}
              >
                <Bus className="w-4 h-4" /> Ônibus
              </button>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-3 block">
                {prefs.transportType === "flight" ? "Cia aérea preferida" : "Viação preferida"}
              </label>
              <div className="flex flex-wrap gap-2">
                {CARRIERS.map((c) => (
                  <button
                    key={c}
                    onClick={() => update("preferredCarrier", c)}
                    className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border", prefs.preferredCarrier === c ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-border-hover")}
                  >
                    {c}
                  </button>
                ))}
                <button
                  onClick={() => update("preferredCarrier", "")}
                  className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border", prefs.preferredCarrier === "" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-border-hover")}
                >
                  Indiferente
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Origin & Itinerary */}
        {currentStep === 1 && (
          <>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Sua cidade base</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prefs.homeCity}
                  onChange={(e) => update("homeCity", e.target.value)}
                  placeholder="Ex: Belo Horizonte"
                  className="flex-1 h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
                <Button variant="secondary" size="sm" onClick={detectLocation} className="shrink-0 h-10 w-10 p-0">
                  <Navigation className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Aeroporto mais próximo</label>
              <input
                type="text"
                value={prefs.homeAirport}
                onChange={(e) => update("homeAirport", e.target.value.toUpperCase())}
                placeholder="Ex: CNF"
                maxLength={3}
                className="w-24 h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 uppercase"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-3 block">Estilo de itinerário</label>
              <div className="flex rounded-xl bg-muted p-1 gap-1">
                <button onClick={() => update("itineraryStyle", "same_day")} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-300", prefs.itineraryStyle === "same_day" ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                  Bate-volta
                </button>
                <button onClick={() => update("itineraryStyle", "buffer")} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-300", prefs.itineraryStyle === "buffer" ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                  Com buffer
                </button>
              </div>
            </div>

            {prefs.itineraryStyle === "buffer" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">Chegar dia antes</span>
                  <Switch checked={prefs.bufferArriveDayBefore} onCheckedChange={(v) => update("bufferArriveDayBefore", v)} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">Sair dia depois</span>
                  <Switch checked={prefs.bufferDepartDayAfter} onCheckedChange={(v) => update("bufferDepartDayAfter", v)} />
                </div>
              </div>
            )}

            <div>
              <label className="text-sm text-muted-foreground mb-3 block">Horário preferido</label>
              <div className="flex rounded-xl bg-muted p-1 gap-1">
                {[
                  { value: "morning" as const, label: "Manhã" },
                  { value: "midday" as const, label: "Meio do dia" },
                  { value: "evening" as const, label: "Noite" },
                ].map((opt) => (
                  <button key={opt.value} onClick={() => update("timePreference", opt.value)} className={cn("flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-300", prefs.timePreference === opt.value ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step 3: Hotel */}
        {currentStep === 2 && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                <div className="flex items-center gap-3">
                  <Hotel className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Divide quarto?</span>
                </div>
                <Switch checked={prefs.hotelShareRoom} onCheckedChange={(v) => update("hotelShareRoom", v)} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                <div className="flex items-center gap-3">
                  <Coffee className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Café da manhã obrigatório?</span>
                </div>
                <Switch checked={prefs.hotelBreakfastRequired} onCheckedChange={(v) => update("hotelBreakfastRequired", v)} />
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-3 block">Tipo de hospedagem</label>
              <div className="grid grid-cols-2 gap-2">
                {HOTEL_TYPES.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update("hotelType", opt.value)}
                    className={cn("flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200", prefs.hotelType === opt.value ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-border-hover")}
                  >
                    <opt.icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step 4: Mobility */}
        {currentStep === 3 && (
          <>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
              <div className="flex items-center gap-3">
                <Car className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Dirige e prefere alugar carro?</span>
              </div>
              <Switch checked={prefs.prefersRentalCar} onCheckedChange={(v) => update("prefersRentalCar", v)} />
            </div>

            {!prefs.prefersRentalCar && (
              <div>
                <label className="text-sm text-muted-foreground mb-3 block">Preferência de transporte</label>
                <div className="flex rounded-xl bg-muted p-1 gap-1">
                  <button onClick={() => update("mobilityPreference", "rideshare")} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-300", prefs.mobilityPreference === "rideshare" ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                    <Car className="w-4 h-4" /> App (Uber/99)
                  </button>
                  <button onClick={() => update("mobilityPreference", "taxi")} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-300", prefs.mobilityPreference === "taxi" ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                    <Car className="w-4 h-4" /> Táxi
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Step 5: Bleisure */}
        {currentStep === 4 && (
          <>
            <div className="rounded-xl gradient-onhappy-soft border border-onhappy/20 p-5 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <img src={onhappyLogo} alt="OnHappy" className="h-8 rounded" />
                <div>
                  <span className="font-semibold text-sm">OnHappy</span>
                  <p className="text-xs text-muted-foreground">Estenda viagens de trabalho com lazer</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Receba sugestões para estender viagens de trabalho com lazer no fim de semana.
                Hospedagem extra com até 60% off.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-onhappy" />
                <span className="text-sm font-medium">Ativar sugestões bleisure?</span>
              </div>
              <Switch checked={prefs.bleisureEnabled} onCheckedChange={(v) => update("bleisureEnabled", v)} className="data-[state=checked]:bg-onhappy" />
            </div>

            {prefs.bleisureEnabled && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                <div className="flex items-center gap-3">
                  <Sun className="w-4 h-4 text-onhappy" />
                  <span className="text-sm font-medium">Viaja com acompanhante?</span>
                </div>
                <Switch checked={prefs.bleisureWithCompanion} onCheckedChange={(v) => update("bleisureWithCompanion", v)} className="data-[state=checked]:bg-onhappy" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-8">
        <Button
          variant="ghost"
          onClick={prev}
          disabled={currentStep === 0}
          className="text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>

        {isLast ? (
          <Button onClick={save} disabled={saving} className="gradient-onfly text-primary-foreground border-0 px-8 hover:-translate-y-0.5 transition-all">
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
            ) : (
              <>Começar<ArrowRight className="h-4 w-4 ml-1" /></>
            )}
          </Button>
        ) : (
          <Button onClick={next} className="gradient-onfly text-primary-foreground border-0 px-8 hover:-translate-y-0.5 transition-all">
            Próximo<ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
