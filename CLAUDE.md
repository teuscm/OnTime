**6a. Deep Links para Onfly (checkout)**

A Onfly usa hash routing com objetos JSON URL-encoded nos query params.
Deep links NÃO funcionam só com IATA codes — precisam de UUIDs e Place IDs.

**Fluxo para gerar deep links:**
```
1. Claude gera itinerário → inclui IATA codes (CNF, REC) e nomes de cidade
2. Backend chama Onfly autocomplete para resolver IDs:
   - Aeroportos: GET /bff/destination/airports?lang=pt-br&search={IATA_CODE}
     Headers: Authorization: Bearer {access_token}
              Accept: application/json
     Base URL: https://toguro-app-prod.onfly.com
     → Retorna: { id (UUID), code, name, placeId, city: { name, stateCode, countryCode, placeId } }
   
   - Cidades: usar autocomplete de destino (endpoint a confirmar)
     → Retorna: { id (UUID), name, placeId, isCity: true, city: { name, stateCode, countryCode } }

3. Backend monta os objetos Airport/City com todos os campos obrigatórios
4. Gera deep link: encodeURIComponent(JSON.stringify(obj))
```

**Deep link de voos:**
```
https://app.onfly.com/travel/#/travel/booking/search?type=flights
  &origin={AIRPORT_JSON_ENCODED}
  &destination={AIRPORT_JSON_ENCODED}
  &outboundDate={YYYY-MM-DD}
  &passengers=[]
  &selectedTravellers=[]
```

**Airport Object (todos os campos obrigatórios):**
```json
{
  "city": { "countryCode": "BR", "name": "Belo Horizonte", "placeId": "ChIJ...", "stateCode": "MG" },
  "code": "CNF",
  "displayName": null,
  "id": "d4d82e17-58d6-40b0-bfb5-48ca90249603",
  "name": "Aeroporto Internacional de Belo Horizonte (CNF)",
  "placeId": "ChIJ...",
  "type": "Airport"
}
```

**Deep link de hotéis:**
```
https://app.onfly.com/travel/#/travel/booking/search?type=hotels
  &city={CITY_JSON_ENCODED}
  &fromDate={YYYY-MM-DD}
  &toDate={YYYY-MM-DD}
  &rooms=[{"guestsQuantity":1,"travelerIds":[]}]
  &selectedTravellers=[]
```

**City Object (todos os campos obrigatórios):**
```json
{
  "city": { "countryCode": "BR", "name": "Recife", "stateCode": "PE" },
  "id": "bb4a2280-6a22-48a4-84f0-1375d7a0e781",
  "isCity": true,
  "name": "Recife",
  "placeId": "ChIJ...",
  "firstCity": true
}
```

**Bleisure (OnHappy):**
```
https://app.onhappy.com.br/hotel-search?guests=18,18&checkin={YYYY-MM-DD}&checkout={YYYY-MM-DD}&description={CITY_NAME_ENCODED}&type=user
```

**API route: `/api/onfly/resolve-ids`**
- Input: IATA code ou city name
- Calls Onfly autocomplete with user's OAuth token
- Returns complete Airport/City object with all UUIDs and Place IDs
- Cache results in memory (airports don't change often)

**FALLBACK (se autocomplete API falhar):**
Manter um dicionário hardcoded dos 20 aeroportos mais usados no Brasil:
```typescript
const AIRPORTS: Record<string, AirportObject> = {
  "CNF": { id: "d4d82e17-...", code: "CNF", name: "...", ... },
  "GRU": { id: "...", code: "GRU", ... },
  "GIG": { id: "...", code: "GIG", ... },
  "REC": { id: "...", code: "REC", ... },
  // ... top 20
};
```
Pessoa C pode extrair esses IDs durante o profiling e salvar em `data/airports.json`.

---

## Onfly API Specs (from profiling)

### Base URL
`https://toguro-app-prod.onfly.com`

### Authentication Pattern
All BFF endpoints use: `Authorization: Bearer <JWT token>`
Accept: `application/json, text/plain, */*`

### Airport Autocomplete
```
GET /bff/destination/airports?lang=pt-br&search={query}
```
Returns airport objects with UUIDs and Place IDs needed for deep links.

### Quote-Based Flow (BOTH flights and hotels)
The Onfly API uses a quote-based system:
1. Create quote → get `quoteId`
2. Search items via `POST /bff/quote/{quoteId}/item`
3. Filters, sort, pagination are ALL server-side via the same endpoint

### Flight Search

**Step 1: Create quote (the deep link does this automatically when opened)**

**Step 2: Search flights**
```http
POST /bff/quote/{quoteId}/item
Content-Type: application/json
Authorization: Bearer {token}

{
  "page": 1,
  "paginate": true,
  "perPage": 10,
  "flightQuote": {
    "bound": "outbound",
    "filters": {},
    "flightQuoteId": "{flightQuoteId}",
    "groupFlights": true,
    "roundTripType": "twoOneWay",
    "sort": { "key": "cheapestTotalPrice", "order": "asc" }
  }
}
```

**Available flight filters:**
| Filter | Key | Example |
|--------|-----|---------|
| Airline | `ciaManaging` | `["G3"]` (Gol), `["AD"]` (Azul), `["JJ"]` (Latam) |
| Class | `businessClass` | `["Y"]` (Economy), `["W"]` (Premium) |
| Price | `price` | `{"min": 20114, "max": 100000}` (centavos!) |

**Sort keys:** `cheapestPrice`, `cheapestTotalPrice`, `hasAgreement`, `duration`

**Flight response structure (each item in data[]):**
```json
{
  "id": "...",
  "cheapestPrice": 16758,        // centavos = R$167.58
  "cheapestTotalPrice": 20114,   // centavos = R$201.14 (with taxes)
  "duration": 65,                // minutes
  "from": "CNF",
  "to": "GIG",
  "fares": [{
    "family": "LIGHT",
    "businessClass": "Y",
    "ciaManaging": { "code": "G3", "name": "Gol" },
    "totalPrice": 20114,
    "refundable": true
  }],
  "options": {
    "outbounds": [{
      "departure": "2026-05-20 06:30:00",
      "arrival": "2026-05-20 07:40:00",
      "duration": 70,
      "flightNumber": 2031,
      "stopsCount": 0
    }]
  }
}
```

### Hotel Search

**Step 1: Create hotel quote**
```http
POST /bff/quote/create
Content-Type: application/json
Authorization: Bearer {token}

{
  "owners": [null],
  "hotels": [{
    "checkIn": "2026-05-20",
    "checkOut": "2026-05-21",
    "destination": { "type": "cityId", "value": "{cityUUID}" },
    "travelers": [{ "birthday": "2000-01-01", "roomIndex": 0 }]
  }]
}
```
Returns: `quoteId` + `hotelQuoteId`

**Step 2: Search hotels**
```http
POST /bff/quote/{quoteId}/item
Content-Type: application/json
Authorization: Bearer {token}

{
  "page": 1,
  "paginate": true,
  "perPage": 10,
  "hotelQuote": {
    "filters": {},
    "hotelQuoteId": "{hotelQuoteId}",
    "sort": { "key": "cheapestPrice", "order": "asc" }
  }
}
```

**Available hotel filters:**
| Filter | Key | Example |
|--------|-----|---------|
| Price min | `priceDailyMin` | `7400` (centavos) |
| Price max | `priceDailyMax` | `174600` (centavos) |
| Stars | `stars` | `[3, 4, 5]` |
| Breakfast | `breakfast` | `true` |
| Name | `name` | `"Mar Hotel"` |
| Neighborhood | `neighborhood` | `["Boa Viagem"]` |
| Within policy | `withinPolicy` | `true` |
| Agreement | `agreement` | `true` |

**Sort keys:** `cheapestPrice`, `name`, `stars`, `favorite`, `recommended`

**Hotel response structure (each item in data[]):**
```json
{
  "id": "...",
  "name": "Casa Recife Pousada",
  "stars": 2,
  "cheapestPrice": 7487,          // centavos = R$74.87
  "cheapestDailyPrice": 7487,     // per night
  "breakfast": false,
  "refundable": false,
  "agreement": false,
  "coordinates": { "lat": -8.1252, "lng": -34.90762 },
  "thumb": "https://i.travelapi.com/...",
  "neighborhood": "Pina",
  "address": "Rua ...",
  "amenities": ["wifi", "pool"]
}
```

### Key Constants
- **All prices are in CENTAVOS** (divide by 100 for BRL)
- **Airline IATA codes:** G3=Gol, AD=Azul, JJ=Latam
- **Classes:** Y=Economy, W=Premium Economy
- **BFF base:** `https://toguro-app-prod.onfly.com/bff/*`# CLAUDE.md — OnTime by Onfly

## Project Overview
OnTime is an AI-powered corporate travel assistant that reads calendar events, detects travel needs, quotes flights/hotels via Onfly APIs, resolves schedule conflicts, and generates complete itineraries — all automatically.

**Context:** Hackathon Onfly Tech — 100% IA. Deadline: 16:00 (pitch). Team of 3.
- Tools allowed: Lovable + Claude Code ONLY for delivery
- Must be a WORKING product in production (no slides/PPTs)
- Deliverables: Product + Landing Page (done) + LinkedIn Ads
- Judging: Problem, Innovation, Execution, Impact, Presentation (4 min pitch)
- APIs: Onfly frontend-facing APIs are allowed (anything visible in DevTools). Backend-only internal APIs are NOT.
- Cannot modify Onfly codebase. Cannot ask external humans for help.
- Prioritize WORKING features over perfection. If something will take >30 min, find a shortcut.

---

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui (match the landing page design system)
- **Auth:** Onfly OAuth2 (JWT) — primary login method
- **Calendar:** Google Calendar API (OAuth2, read+write scopes)
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514) for itinerary matching & conflict resolution
- **Database:** SQLite via better-sqlite3 (user preferences, cached tokens) — or Supabase if time allows
- **Deploy:** Local dev server for demo (or Vercel if time allows)

---

## Design System (from Landing Page)
```
Primary Color: #009EFB (Onfly blue) — used in gradient-onfly
Secondary Color: OnHappy gradient (warm orange/coral)
Font: System font stack (Inter if available)
Border Radius: 0.75rem for cards, 0.5rem for buttons
Shadows: shadow-sm for cards, shadow-lg for hero elements

CSS Classes to reuse from landing:
- gradient-onfly: linear-gradient for primary actions
- gradient-onfly-soft: subtle background gradient
- gradient-onhappy: OnHappy CTA gradient
- glow-card: card with subtle glow effect
- tilt-card: card with perspective tilt on hover

Icons: Lucide React (already used in landing)
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                  FRONTEND                    │
│  Next.js App Router + Tailwind + shadcn/ui  │
│                                             │
│  /                → Landing/Login            │
│  /dashboard       → Main itinerary view      │
│  /onboarding      → Preferences setup        │
│  /calendar        → Calendar sync status     │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│              API ROUTES (Next.js)            │
│                                             │
│  /api/auth/onfly/callback  → OAuth2 callback │
│  /api/auth/google/callback → Google OAuth    │
│  /api/calendar/events      → Fetch events    │
│  /api/calendar/create      → Create events   │
│  /api/onfly/search-flights → Proxy to Onfly  │
│  /api/onfly/search-hotels  → Proxy to Onfly  │
│  /api/itinerary/generate   → Claude AI call  │
│  /api/preferences          → CRUD prefs      │
└──────────────┬──────────────────────────────┘
               │
    ┌──────────┼──────────────┐
    ▼          ▼              ▼
 Onfly API  Google Cal    Claude API
 (flights,  (events       (itinerary
  hotels,    read/write)   matching,
  mobility)               conflicts)
```

---

## Features (in execution order)

### Feature 1 — Onfly OAuth2 Login (30 min)

**IMPORTANT: Tested and validated flow from previous project.**

**Environment Variables:**
```env
ONFLY_CLIENT_ID=<your_client_id>
ONFLY_CLIENT_SECRET=<your_client_secret>
ONFLY_AUTH_BASE_URL=https://app.onfly.com/v2
ONFLY_REDIRECT_URI=http://localhost:3000/api/auth/onfly/callback
ONFLY_TOKEN_URL=https://api.onfly.com/oauth/token
ONFLY_USER_INFO_URL=https://api.onfly.com/employees/me
ONFLY_COMPANY_URL=https://api.onfly.com/employees
```

**Step 1 — Redirect to Onfly authorization:**
Generate random `state` (UUID), store in cookie/session (300s TTL), redirect to:
```
https://app.onfly.com/v2#/auth/oauth/authorize?response_type=code&client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&state={state}
```
⚠️ **GOTCHA:** Onfly uses hash-based SPA routing. OAuth params go inside the fragment (`#/auth/oauth/authorize?...`), NOT as a normal URL path.

**Step 2 — Handle callback:**
Onfly redirects back to `REDIRECT_URI` with `?code=...&state=...`
Validate `state` matches stored value (CSRF protection).

**Step 3 — Exchange code for token:**
```http
POST https://api.onfly.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code={code}
&redirect_uri={REDIRECT_URI}
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
```
Returns: `{ access_token, token_type }`
⚠️ **GOTCHA:** Onfly returns `429` if rate limited on token exchange. Add retry with backoff.

**Step 4 — Fetch user info:**
```http
GET https://api.onfly.com/employees/me?include=permissions
Authorization: {token_type} {access_token}
Accept: application/prs.onfly.v1+json
```
⚠️ **GOTCHA:** The `Accept: application/prs.onfly.v1+json` header is REQUIRED on ALL Onfly API calls.
⚠️ **GOTCHA:** `?include=permissions` is mandatory. Without it, `permissions.data` is absent.

Response:
```json
{
  "data": {
    "id": 12345,
    "email": "user@company.com",
    "name": "User Name",
    "permissions": { "data": { "id": 1 } }
  }
}
```
Admin check: `permissions.data.id === 1`

**Step 5 — Fetch company info:**
```http
GET https://api.onfly.com/employees/{onflyUserId}/company?include=plan.modules.options,logo,permissions,employeesCount,settingsLocale
Authorization: {token_type} {access_token}
Accept: application/prs.onfly.v1+json
```
Response:
```json
{
  "data": {
    "document": "12345678000100",
    "fantasyName": "Company Name"
  }
}
```
Use `document` (CNPJ) as stable company identifier.

**After login:**
- Store `access_token` + `token_type` + `onfly_user_id` + `company_document` in encrypted httpOnly cookie (use `jose` library for JWT)
- First login (no preferences) → redirect to `/onboarding`
- Returning user → redirect to `/dashboard`

### Feature 2 — Onboarding de Preferências (45 min)
Multi-step wizard, shown once after first login. Stored in SQLite keyed by Onfly user ID.

**Step 1 — Transporte**
- Prefere aéreo ou ônibus? (toggle/radio)
- Companhia aérea/viação de preferência (LATAM, GOL, Azul, ou Indiferente / combobox)

**Step 2 — Origem & Itinerário**
- Home location: detectar via browser Geolocation API, resolver para cidade/aeroporto mais próximo. Editável com autocomplete de cidades.
- Estilo de itinerário:
  - **Bate-volta** (ida e volta no mesmo dia)
  - **Buffer** (chegar 1 dia antes e/ou sair 1 dia depois)
- Preferência de horário: manhã cedo / meio do dia / noite

**Step 3 — Hospedagem**
- Divide quarto? (sim/não)
- Café da manhã obrigatório? (toggle)
- Preferência de hospedagem: Hotel tradicional / Airbnb / Charlie / Indiferente

**Step 4 — Mobilidade**
- Dirige e prefere alugar carro? (sim/não)
- Se não: prefere app de mobilidade (Uber/99) ou táxi? (radio)

**Step 5 — Bleisure**
- Quer receber sugestões de estender viagens no fim de semana pela OnHappy? (toggle)
- Se sim: preferências extras (viaja com acompanhante? interesse em passeios?)

Todas as preferências podem ser editadas depois em /settings.

### Feature 3 — Conexão com Agenda (30 min)
- Tela de seleção: Google Calendar / Microsoft Outlook / Outro (manual)
- **Google Calendar:** OAuth2 com scopes `calendar.readonly` + `calendar.events` (read + write)
- **Outlook:** OAuth2 com Microsoft Graph API (scope: `Calendars.ReadWrite`)
- **Outro:** input manual ou iCal URL import (stretch goal)
- Armazenar refresh token por provider, vinculado ao user Onfly
- Para o hackathon MVP: implementar Google Calendar, Outlook como placeholder UI

### Feature 4 — Varredura de Agenda (30 min)
- Fetch eventos dos próximos 30 dias
- Filtro inteligente via Claude: identificar eventos que têm **local definido** diferente do home location do usuário
- Para cada evento candidato a viagem, extrair:
  - Título, data/hora início e fim, localização (endereço ou cidade)
  - Participantes (para contexto de "divide quarto")
  - Recorrência (ignorar eventos recorrentes locais tipo daily)
- Apresentar lista de "viagens detectadas" para o usuário confirmar quais quer planejar

### Feature 5 — Sugestão de Itinerário Completo (45 min)
O coração do produto. Claude API recebe: eventos confirmados + preferências do usuário + home location.

**Fluxo de dados:**
```
1. Claude gera itinerário (cidades, datas, horários sugeridos)
2. Backend resolve IDs via autocomplete (IATA → Airport UUID)
3. Backend cria quote na Onfly: POST /bff/quote/create
4. Backend busca voos reais: POST /bff/quote/{quoteId}/item
   → Filtra por: cia preferida (ciaManaging), classe (Y), preço
5. Backend busca hotéis reais: POST /bff/quote/create (hotel) → /item
   → Filtra por: breakfast, stars, withinPolicy
6. Claude recebe resultados e seleciona melhor match vs preferências
7. Frontend mostra itinerário com preços REAIS da Onfly
```

**API routes necessárias:**
- `POST /api/onfly/create-flight-quote` → proxy para POST /bff/quote/create
- `POST /api/onfly/search-flights` → proxy para POST /bff/quote/{id}/item
- `POST /api/onfly/create-hotel-quote` → proxy para POST /bff/quote/create
- `POST /api/onfly/search-hotels` → proxy para POST /bff/quote/{id}/item

**Aplicar preferências como filtros server-side:**
- Usuário prefere LATAM → filter: `ciaManaging: ["JJ"]`
- Café obrigatório → filter: `breakfast: true`
- Buffer style → buscar voo do dia anterior
- Bate-volta → buscar voo ida e volta no mesmo dia

Claude retorna itinerário completo para cada viagem:
```json
{
  "trips": [{
    "event": {
      "title": "Reunião com cliente",
      "datetime": "2026-05-20T14:00:00",
      "location": "Av. Boa Viagem, 1000 - Recife/PE",
      "duration_hours": 2
    },
    "transport": {
      "type": "flight",
      "outbound": {
        "origin": "CNF",
        "destination": "REC",
        "suggested_date": "2026-05-20",
        "suggested_time": "06:00",
        "reason": "Chegar com 2h de buffer antes da reunião"
      },
      "return": {
        "origin": "REC",
        "destination": "CNF",
        "suggested_date": "2026-05-20",
        "suggested_time": "19:00",
        "reason": "Bate-volta conforme preferência do usuário"
      }
    },
    "hotel": null,
    "mobility": [
      { "leg": "Casa → Aeroporto CNF", "type": "uber", "time": "04:30" },
      { "leg": "Aeroporto REC → Reunião", "type": "uber", "time": "12:30" },
      { "leg": "Reunião → Aeroporto REC", "type": "uber", "time": "17:00" }
    ],
    "conflicts": [
      {
        "event": "Daily de produto",
        "original_time": "10:00-11:00",
        "conflict_reason": "Usuário estará em voo",
        "suggestion": "Participar remoto pelo celular",
        "alternative_time": null
      }
    ],
    "bleisure": {
      "eligible": true,
      "reason": "Viagem na sexta-feira",
      "onhappy_link": "https://app.onhappy.com.br/hotel-search?guests=18,18&checkin=2026-05-20&checkout=2026-05-22&description=Recife+-+PE&type=user"
    },
    "calendar_events_to_create": [
      { "title": "🚗 Uber → Aeroporto CNF", "start": "04:30", "end": "05:30" },
      { "title": "✈️ Voo CNF → REC", "start": "06:00", "end": "09:30" },
      { "title": "🚗 Uber → Reunião", "start": "12:30", "end": "13:30" },
      { "title": "🚗 Uber → Aeroporto REC", "start": "17:00", "end": "17:30" },
      { "title": "✈️ Voo REC → CNF", "start": "19:00", "end": "22:00" }
    ]
  }]
}
```

Usuário vê o itinerário completo em timeline visual (estilo landing page).
Cada item tem botão: ✅ Confirmar / ✏️ Ajustar / ❌ Remover.
Ao confirmar, dispara Feature 6.

### Feature 6 — Reserva + Trava de Agenda (30 min)
Ao confirmar o itinerário:

**6a. Deep Links para Onfly (checkout)**

A Onfly usa hash routing com objetos JSON URL-encoded nos query params.
Deep links NÃO funcionam só com IATA codes — precisam de UUIDs e Place IDs.

**Fluxo para gerar deep links:**
```
1. Claude gera itinerário → inclui IATA codes (CNF, REC) e nomes de cidade
2. Backend chama Onfly autocomplete para resolver IDs:
   - Aeroportos: GET /bff/airport?search={IATA_CODE}
     Headers: Authorization: {token_type} {access_token}
              Accept: application/prs.onfly.v1+json
     → Retorna: { id (UUID), code, name, placeId, city: { name, stateCode, countryCode, placeId } }
   
   - Cidades: GET /bff/city?search={city_name} (ou endpoint similar)
     → Retorna: { id (UUID), name, placeId, isCity: true, city: { name, stateCode, countryCode } }

3. Backend monta os objetos Airport/City com todos os campos obrigatórios
4. Gera deep link: encodeURIComponent(JSON.stringify(obj))
```

**Deep link de voos:**
```
https://app.onfly.com/travel/#/travel/booking/search?type=flights
  &origin={AIRPORT_JSON_ENCODED}
  &destination={AIRPORT_JSON_ENCODED}
  &outboundDate={YYYY-MM-DD}
  &passengers=[]
  &selectedTravellers=[]
```

**Airport Object (todos os campos obrigatórios):**
```json
{
  "city": { "countryCode": "BR", "name": "Belo Horizonte", "placeId": "ChIJ...", "stateCode": "MG" },
  "code": "CNF",
  "displayName": null,
  "id": "d4d82e17-58d6-40b0-bfb5-48ca90249603",
  "name": "Aeroporto Internacional de Belo Horizonte (CNF)",
  "placeId": "ChIJ...",
  "type": "Airport"
}
```

**Deep link de hotéis:**
```
https://app.onfly.com/travel/#/travel/booking/search?type=hotels
  &city={CITY_JSON_ENCODED}
  &fromDate={YYYY-MM-DD}
  &toDate={YYYY-MM-DD}
  &rooms=[{"guestsQuantity":1,"travelerIds":[]}]
  &selectedTravellers=[]
```

**City Object (todos os campos obrigatórios):**
```json
{
  "city": { "countryCode": "BR", "name": "Recife", "stateCode": "PE" },
  "id": "bb4a2280-6a22-48a4-84f0-1375d7a0e781",
  "isCity": true,
  "name": "Recife",
  "placeId": "ChIJ...",
  "firstCity": true
}
```

**Bleisure (OnHappy):**
```
https://app.onhappy.com.br/hotel-search?guests=18,18&checkin={YYYY-MM-DD}&checkout={YYYY-MM-DD}&description={CITY_NAME_ENCODED}&type=user
```

**API route: `/api/onfly/resolve-ids`**
- Input: IATA code ou city name
- Calls Onfly autocomplete with user's OAuth token
- Returns complete Airport/City object with all UUIDs and Place IDs
- Cache results in memory (airports don't change often)

**FALLBACK (se autocomplete API falhar):**
Manter um dicionário hardcoded dos 20 aeroportos mais usados no Brasil:
```typescript
const AIRPORTS: Record<string, AirportObject> = {
  "CNF": { id: "d4d82e17-...", code: "CNF", name: "...", ... },
  "GRU": { id: "...", code: "GRU", ... },
  "GIG": { id: "...", code: "GIG", ... },
  "REC": { id: "...", code: "REC", ... },
  // ... top 20
};
```
Pessoa C pode extrair esses IDs durante o profiling e salvar em `data/airports.json`.

**6b. Trava de horários na agenda**
- Criar eventos de deslocamento no Google Calendar via API (write)
- Cada leg do itinerário vira um evento (com emoji + descrição)
- Eventos marcados como "Busy" para bloquear a agenda
- Metadata no evento: `description` inclui "Criado pelo OnTime | Onfly"
- Conflitos: se houver evento no horário, sugerir mover ou mudar para remoto

---

## File Structure
```
ontime/
├── CLAUDE.md
├── package.json
├── next.config.js
├── tailwind.config.ts
├── .env.local                 # All secrets here
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout with fonts, theme
│   │   ├── page.tsx           # Landing / Login page
│   │   ├── dashboard/
│   │   │   └── page.tsx       # Main itinerary view
│   │   ├── onboarding/
│   │   │   └── page.tsx       # Preferences wizard
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── onfly/
│   │       │   │   ├── route.ts      # Initiate OAuth
│   │       │   │   └── callback/
│   │       │   │       └── route.ts  # Handle callback
│   │       │   └── google/
│   │       │       ├── route.ts
│   │       │       └── callback/
│   │       │           └── route.ts
│   │       ├── calendar/
│   │       │   ├── events/route.ts
│   │       │   └── create/route.ts
│   │       ├── onfly/
│   │       │   ├── search-flights/route.ts
│   │       │   └── search-hotels/route.ts
│   │       ├── itinerary/
│   │       │   └── generate/route.ts
│   │       └── preferences/
│   │           └── route.ts
│   ├── components/
│   │   ├── ui/                # shadcn components
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   └── Footer.tsx
│   │   ├── dashboard/
│   │   │   ├── TripCard.tsx
│   │   │   ├── TimelineView.tsx
│   │   │   ├── ConflictCard.tsx
│   │   │   └── ItinerarySuggestion.tsx
│   │   ├── onboarding/
│   │   │   ├── PreferenceStep.tsx
│   │   │   └── TransportToggle.tsx
│   │   └── calendar/
│   │       └── CalendarSync.tsx
│   ├── lib/
│   │   ├── onfly.ts           # Onfly API client
│   │   ├── google-calendar.ts # Google Calendar helpers
│   │   ├── claude.ts          # Claude API for itinerary
│   │   ├── db.ts              # SQLite connection
│   │   └── auth.ts            # Token management
│   └── types/
│       └── index.ts           # All TypeScript types
├── data/
│   └── ontime.db              # SQLite database
└── public/
    └── onfly-logo.svg
```

---

## Environment Variables (.env.local)
```
# Onfly OAuth2 (VALIDATED — do not change URL patterns)
ONFLY_CLIENT_ID=
ONFLY_CLIENT_SECRET=
ONFLY_AUTH_BASE_URL=https://app.onfly.com/v2
ONFLY_REDIRECT_URI=http://localhost:3000/api/auth/onfly/callback
ONFLY_TOKEN_URL=https://api.onfly.com/oauth/token
ONFLY_USER_INFO_URL=https://api.onfly.com/employees/me
ONFLY_COMPANY_URL=https://api.onfly.com/employees

# Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Claude API
ANTHROPIC_API_KEY=

# App
APP_SECRET=generate-a-random-string-here
APP_URL=http://localhost:3000
```

---

## Execution Timeline (12:30 → 16:00)

### Phase 1: Scaffold (12:30 - 13:00) — 30 min
- [ ] `npx create-next-app@latest ontime --typescript --tailwind --app`
- [ ] Install: shadcn/ui, lucide-react, better-sqlite3, jose (JWT)
- [ ] Copy design tokens from landing page CSS
- [ ] Create basic layout with Navbar (OnTime logo + nav)
- [ ] Create login page with "Entrar com Onfly" button
- [ ] Setup .env.local with all keys

### Phase 2: Auth + Onboarding (13:00 - 14:00) — 60 min
- [ ] Implement Onfly OAuth2 flow (authorize → callback → JWT cookie)
- [ ] Build 5-step onboarding wizard:
  - Step 1: Transporte (aéreo/ônibus + cia preferida)
  - Step 2: Origem & Itinerário (geolocation + bate-volta/buffer + horário)
  - Step 3: Hospedagem (divide quarto + café + tipo)
  - Step 4: Mobilidade (aluga carro? ou app?)
  - Step 5: Bleisure (sugestões OnHappy?)
- [ ] SQLite table for user preferences
- [ ] Redirect logic: no prefs → onboarding, has prefs → dashboard

### Phase 3: Calendar + Varredura (14:00 - 14:45) — 45 min
- [ ] Google Calendar OAuth2 flow (read+write scopes)
- [ ] Outlook placeholder UI (logo + "em breve")
- [ ] Fetch events próximos 30 dias
- [ ] Claude filtra: eventos com local ≠ home location
- [ ] Tela "Viagens detectadas" com checkbox para confirmar quais planejar

### Phase 4: Itinerário AI + Onfly APIs (14:45 - 15:30) — 45 min
- [ ] Claude gera itinerário completo (transport + hotel + mobility + conflicts + bleisure)
- [ ] Timeline visual estilo landing page
- [ ] Botões ✅ Confirmar / ✏️ Ajustar / ❌ Remover por item
- [ ] Integrar APIs Onfly (spec vindo do Cowork) para busca real de voos/hotéis
- [ ] Deep links de checkout (Onfly + OnHappy)

### Phase 5: Reserva + Agenda (15:30 - 15:50) — 20 min
- [ ] Ao confirmar: criar eventos de deslocamento no Google Calendar
- [ ] Eventos com emoji (🚗 ✈️ 🏨) + marcados como "Busy"
- [ ] Description: "Criado pelo OnTime | Onfly"
- [ ] Conflitos: sugerir mover evento ou mudar para remoto

### Phase 6: Polish + Demo (15:50 - 16:00) — 10 min
- [ ] Loading states e error handling
- [ ] Test full flow: Login → Onboarding → Calendar → Itinerário → Reserva
- [ ] Preparar script de demo

---

## Claude API Prompt Template (for itinerary generation)

```
You are OnTime, an AI corporate travel planner integrated with Onfly.

Given a traveler's calendar events and personal preferences, generate an optimized travel itinerary for each trip.

## User Preferences
{preferences_json}

## User Home Location
{home_city} (nearest airport: {home_airport})

## Calendar Events (next 30 days, already filtered for travel-worthy)
{events_json}

## Instructions
1. For each event, plan the FULL door-to-door itinerary:
   - Ground transport: home → airport (consider time of day + distance)
   - Flight/bus: based on preference (aéreo or ônibus)
   - Ground transport: destination airport/station → meeting location
   - Hotel: only if itinerary style is "buffer" or meeting spans multiple days
   - Return: reverse of above
   
2. Apply itinerary style from preferences:
   - "bate-volta": same-day round trip, tight schedule
   - "buffer": arrive day before and/or leave day after, relaxed
   
3. Apply all preferences:
   - Preferred airline/bus company for transport suggestions
   - Hotel: shared room, breakfast required, type (hotel/airbnb/charlie)
   - Mobility: rental car vs rideshare app
   - Time preference: manhã cedo / meio do dia / noite
   
4. Detect conflicts with other calendar events during travel time.
   For each conflict suggest ONE of:
   - "Participar remoto" (if meeting can be remote)
   - "Mover para [novo horário]" (suggest specific alternative)
   
5. Bleisure check: if user opted in AND trip touches Thu/Fri/weekend,
   flag as bleisure eligible and generate OnHappy deep link.

6. Generate calendar events to create:
   - Each leg of transport with emoji prefix (🚗 🚌 ✈️ 🏨)
   - Mark as "Busy" to block agenda
   - Include "Criado pelo OnTime | Onfly" in description

Respond ONLY with valid JSON. No markdown. No explanation.
Schema: {schema_json}
```

---

## Key Design Decisions
1. **No real-time sync** — we fetch calendar on dashboard load, not via webhooks (too complex for hackathon)
2. **SQLite over Supabase** — zero setup time, runs locally, good enough for demo
3. **Onfly APIs as proxy** — never expose Onfly tokens to frontend
4. **Claude for intelligence** — deterministic logic for simple conflicts, Claude for complex itinerary optimization
5. **Deep links for checkout** — don't implement booking flow, redirect to Onfly/OnHappy with pre-filled params

---

## Database Schema (SQLite)

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  onfly_user_id TEXT UNIQUE NOT NULL,
  
  -- Step 1: Transporte
  transport_type TEXT DEFAULT 'flight',        -- 'flight' | 'bus'
  preferred_carrier TEXT DEFAULT '',            -- 'LATAM' | 'GOL' | 'Azul' | '' (indiferente)
  
  -- Step 2: Origem & Itinerário
  home_city TEXT DEFAULT '',                    -- 'Belo Horizonte'
  home_airport TEXT DEFAULT '',                 -- 'CNF'
  home_lat REAL,
  home_lng REAL,
  itinerary_style TEXT DEFAULT 'buffer',        -- 'same_day' | 'buffer'
  buffer_arrive_day_before INTEGER DEFAULT 0,   -- 0 or 1
  buffer_depart_day_after INTEGER DEFAULT 0,    -- 0 or 1
  time_preference TEXT DEFAULT 'morning',       -- 'morning' | 'midday' | 'evening'
  
  -- Step 3: Hospedagem
  hotel_share_room INTEGER DEFAULT 0,           -- 0 or 1
  hotel_breakfast_required INTEGER DEFAULT 1,   -- 0 or 1
  hotel_type TEXT DEFAULT '',                   -- 'hotel' | 'airbnb' | 'charlie' | '' (indiferente)
  
  -- Step 4: Mobilidade
  prefers_rental_car INTEGER DEFAULT 0,         -- 0 or 1
  mobility_preference TEXT DEFAULT 'rideshare', -- 'rideshare' | 'taxi'
  
  -- Step 5: Bleisure
  bleisure_enabled INTEGER DEFAULT 0,           -- 0 or 1
  bleisure_with_companion INTEGER DEFAULT 0,    -- 0 or 1
  
  -- Meta
  onboarding_completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calendar_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  onfly_user_id TEXT NOT NULL,
  provider TEXT NOT NULL,                       -- 'google' | 'outlook'
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TEXT,
  calendar_id TEXT DEFAULT 'primary',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(onfly_user_id, provider)
);

CREATE TABLE IF NOT EXISTS itineraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  onfly_user_id TEXT NOT NULL,
  event_id TEXT,                                -- Google Calendar event ID
  status TEXT DEFAULT 'suggested',              -- 'suggested' | 'confirmed' | 'booked'
  itinerary_json TEXT,                          -- Full Claude-generated JSON
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

---

## Critical API Gotchas (READ BEFORE CODING)

### Onfly API — Non-Negotiable Rules
| Rule | Detail |
|------|--------|
| Accept header | `application/prs.onfly.v1+json` — REQUIRED on every single API call |
| Auth URL format | Hash-fragment routing: `BASE_URL#/auth/oauth/authorize?params` (NOT a normal path) |
| Token exchange | `Content-Type: application/x-www-form-urlencoded` (NOT JSON) |
| Rate limiting | Onfly returns `429` on token exchange — implement retry with exponential backoff |
| User info | Must include `?include=permissions` query param or permissions data is missing |
| Admin check | `permissions.data.id === 1` means admin |
| Company ID | Use `document` field (CNPJ) as stable company identifier, NOT the numeric ID |
| Authorization header | Format: `{token_type} {access_token}` (token_type is usually "Bearer") |

### Google Calendar API — Key Points
| Rule | Detail |
|------|--------|
| Scopes needed | `https://www.googleapis.com/auth/calendar.readonly` + `https://www.googleapis.com/auth/calendar.events` |
| Events endpoint | `GET https://www.googleapis.com/calendar/v3/calendars/primary/events` |
| Create event | `POST https://www.googleapis.com/calendar/v3/calendars/primary/events` |
| Filter params | `timeMin`, `timeMax` (RFC3339), `singleEvents=true`, `orderBy=startTime` |
| Write events | Set `transparency: "opaque"` to mark as Busy |

---

## Code Style
- TypeScript strict mode
- Server components by default, "use client" only when needed
- API routes handle all external calls (no client-side API calls to Onfly/Google)
- Portuguese for user-facing text, English for code/comments
- Reuse landing page visual patterns (gradient-onfly, glow-card, etc.)

---

## Demo Script (for judges)
1. **Login** → "Entrar com Onfly" → OAuth redirect → volta autenticado
2. **Onboarding** → 5 steps: transporte, origem/itinerário, hospedagem, mobilidade, bleisure
3. **Conectar agenda** → Google Calendar OAuth → eventos carregados
4. **Varredura** → "3 viagens detectadas" → usuário confirma quais planejar
5. **Itinerário AI** → Timeline completa: transporte + hotel + mobilidade + conflitos
6. **Preços reais** → "Voo LATAM CNF→REC R$201,14" (dados da API Onfly ao vivo!)
7. **Conflitos** → "Daily de produto conflita com voo" → resolver com 1 clique
8. **Bleisure** → "Viagem na sexta, estenda pelo OnHappy?" → link OnHappy
9. **Reservar** → Deep link para Onfly com busca pré-preenchida
10. **Agenda atualizada** → Mostrar eventos criados no Google Calendar (🚗 ✈️ 🏨)