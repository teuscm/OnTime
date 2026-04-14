// City name → Onfly IATA/city code mapping
// Used client-side to resolve calendar event locations to flight search codes

const CITY_TO_CODE: Record<string, string> = {
  "são paulo": "SAO", "sao paulo": "SAO", "sp": "SAO", "guarulhos": "GRU", "congonhas": "CGH",
  "rio de janeiro": "RIO", "rio": "RIO", "galeão": "GIG", "santos dumont": "SDU",
  "belo horizonte": "BHZ", "confins": "CNF", "pampulha": "PLU",
  "brasília": "BSB", "brasilia": "BSB",
  "recife": "REC", "salvador": "SSA", "fortaleza": "FOR",
  "curitiba": "CWB", "porto alegre": "POA", "florianópolis": "FLN", "florianopolis": "FLN",
  "campinas": "VCP", "goiânia": "GYN", "goiania": "GYN",
  "manaus": "MAO", "belém": "BEL", "belem": "BEL",
  "vitória": "VIX", "vitoria": "VIX", "natal": "NAT",
  "joão pessoa": "JPA", "joao pessoa": "JPA", "maceió": "MCZ", "maceio": "MCZ",
  "campo grande": "CGR", "cuiabá": "CGB", "cuiaba": "CGB",
};

export function resolveDestinationCode(location: string): string | null {
  const lower = location.toLowerCase();
  for (const [city, code] of Object.entries(CITY_TO_CODE)) {
    if (lower.includes(city)) return code;
  }
  const iataMatch = location.match(/\b([A-Z]{3})\b/);
  if (iataMatch) return iataMatch[1];
  return null;
}
