"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Plane,
  Bus,
  Hotel,
  Car,
  Sun,
  Coffee,
  Sparkles,
  Check,
  Loader2,
  Navigation,
} from "lucide-react";

interface SettingsContentProps {
  initialPrefs: Record<string, unknown> | null | undefined;
}

export function SettingsContent({ initialPrefs }: SettingsContentProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [prefs, setPrefs] = useState({
    transportType: (initialPrefs?.transport_type as string) || "flight",
    preferredCarrier: (initialPrefs?.preferred_carrier as string) || "",
    homeCity: (initialPrefs?.home_city as string) || "",
    homeAirport: (initialPrefs?.home_airport as string) || "",
    itineraryStyle: (initialPrefs?.itinerary_style as string) || "buffer",
    bufferArriveDayBefore: initialPrefs?.buffer_arrive_day_before === 1,
    bufferDepartDayAfter: initialPrefs?.buffer_depart_day_after === 1,
    timePreference: (initialPrefs?.time_preference as string) || "morning",
    hotelShareRoom: initialPrefs?.hotel_share_room === 1,
    hotelBreakfastRequired: initialPrefs?.hotel_breakfast_required !== 0,
    hotelType: (initialPrefs?.hotel_type as string) || "",
    prefersRentalCar: initialPrefs?.prefers_rental_car === 1,
    mobilityPreference: (initialPrefs?.mobility_preference as string) || "rideshare",
    bleisureEnabled: initialPrefs?.bleisure_enabled === 1,
    bleisureWithCompanion: initialPrefs?.bleisure_with_companion === 1,
  });

  const update = (key: string, value: unknown) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...prefs, onboardingCompleted: true }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.03em] mb-1">Preferências</h1>
          <p className="text-sm text-muted-foreground">Configure como o OnTime planeja suas viagens.</p>
        </div>
        <Button onClick={save} disabled={saving} className={cn("transition-all", saved ? "bg-emerald-500 hover:bg-emerald-500/90" : "gradient-onfly")} >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
          ) : saved ? (
            <><Check className="w-4 h-4" />Salvo</>
          ) : (
            "Salvar alterações"
          )}
        </Button>
      </div>

      {/* Transport */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl gradient-onfly flex items-center justify-center">
              <Plane className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Transporte</h3>
              <p className="text-sm text-muted-foreground">Como você prefere viajar</p>
            </div>
          </div>

          <div className="flex rounded-xl bg-muted p-1 gap-1 mb-4">
            <button onClick={() => update("transportType", "flight")} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all", prefs.transportType === "flight" ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground")}>
              <Plane className="w-4 h-4" /> Aéreo
            </button>
            <button onClick={() => update("transportType", "bus")} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all", prefs.transportType === "bus" ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground")}>
              <Bus className="w-4 h-4" /> Ônibus
            </button>
          </div>

          <label className="text-sm text-muted-foreground mb-2 block">Companhia preferida</label>
          <div className="flex flex-wrap gap-2">
            {["LATAM", "GOL", "Azul", ""].map((c) => (
              <button key={c} onClick={() => update("preferredCarrier", c)} className={cn("px-4 py-2 rounded-xl text-sm font-medium border transition-all", prefs.preferredCarrier === c ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground")}>
                {c || "Indiferente"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Origin */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl gradient-onfly flex items-center justify-center">
              <Navigation className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Origem & Itinerário</h3>
              <p className="text-sm text-muted-foreground">De onde você sai</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Cidade base</label>
              <input type="text" value={prefs.homeCity} onChange={(e) => update("homeCity", e.target.value)} placeholder="Ex: Belo Horizonte" className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Aeroporto</label>
              <input type="text" value={prefs.homeAirport} onChange={(e) => update("homeAirport", e.target.value.toUpperCase())} placeholder="CNF" maxLength={3} className="w-24 h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 uppercase" />
            </div>
          </div>

          <label className="text-sm text-muted-foreground mb-2 block">Estilo de itinerário</label>
          <div className="flex rounded-xl bg-muted p-1 gap-1 mb-4">
            <button onClick={() => update("itineraryStyle", "same_day")} className={cn("flex-1 py-2.5 rounded-lg text-sm font-medium transition-all", prefs.itineraryStyle === "same_day" ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground")}>Bate-volta</button>
            <button onClick={() => update("itineraryStyle", "buffer")} className={cn("flex-1 py-2.5 rounded-lg text-sm font-medium transition-all", prefs.itineraryStyle === "buffer" ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground")}>Com buffer</button>
          </div>

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
        </CardContent>
      </Card>

      {/* Hotel */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl gradient-onfly flex items-center justify-center">
              <Hotel className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Hospedagem</h3>
              <p className="text-sm text-muted-foreground">Suas preferências de hotel</p>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
              <div className="flex items-center gap-3"><Hotel className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Divide quarto</span></div>
              <Switch checked={prefs.hotelShareRoom} onCheckedChange={(v) => update("hotelShareRoom", v)} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
              <div className="flex items-center gap-3"><Coffee className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Café da manhã obrigatório</span></div>
              <Switch checked={prefs.hotelBreakfastRequired} onCheckedChange={(v) => update("hotelBreakfastRequired", v)} />
            </div>
          </div>

          <label className="text-sm text-muted-foreground mb-2 block">Tipo de hospedagem</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "hotel", label: "Hotel tradicional" },
              { value: "airbnb", label: "Airbnb" },
              { value: "charlie", label: "Charlie" },
              { value: "", label: "Indiferente" },
            ].map((opt) => (
              <button key={opt.value} onClick={() => update("hotelType", opt.value)} className={cn("p-3 rounded-xl border text-left text-sm font-medium transition-all", prefs.hotelType === opt.value ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground")}>
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mobility */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl gradient-onfly flex items-center justify-center">
              <Car className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Mobilidade</h3>
              <p className="text-sm text-muted-foreground">Como você se desloca no destino</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors mb-4">
            <div className="flex items-center gap-3"><Car className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Prefere alugar carro</span></div>
            <Switch checked={prefs.prefersRentalCar} onCheckedChange={(v) => update("prefersRentalCar", v)} />
          </div>

          {!prefs.prefersRentalCar && (
            <div className="flex rounded-xl bg-muted p-1 gap-1">
              <button onClick={() => update("mobilityPreference", "rideshare")} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all", prefs.mobilityPreference === "rideshare" ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground")}>
                <Car className="w-4 h-4" /> App (Uber/99)
              </button>
              <button onClick={() => update("mobilityPreference", "taxi")} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all", prefs.mobilityPreference === "taxi" ? "gradient-onfly text-primary-foreground shadow" : "text-muted-foreground")}>
                <Car className="w-4 h-4" /> Táxi
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bleisure */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl gradient-onhappy flex items-center justify-center">
              <Sun className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Bleisure</h3>
              <p className="text-sm text-muted-foreground">Estender viagens com lazer via OnHappy</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
              <div className="flex items-center gap-3"><Sparkles className="w-4 h-4 text-onhappy" /><span className="text-sm font-medium">Ativar sugestões bleisure</span></div>
              <Switch checked={prefs.bleisureEnabled} onCheckedChange={(v) => update("bleisureEnabled", v)} className="data-[state=checked]:bg-onhappy" />
            </div>
            {prefs.bleisureEnabled && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                <div className="flex items-center gap-3"><Sun className="w-4 h-4 text-onhappy" /><span className="text-sm font-medium">Viaja com acompanhante</span></div>
                <Switch checked={prefs.bleisureWithCompanion} onCheckedChange={(v) => update("bleisureWithCompanion", v)} className="data-[state=checked]:bg-onhappy" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
