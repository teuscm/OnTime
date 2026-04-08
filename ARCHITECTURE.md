# ARCHITECTURE.md — OnTime by Onfly

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | Next.js 16 (App Router) | SSR + API routes colocated, single deploy, ideal for OAuth flows and server-side data fetching |
| **Language** | TypeScript (strict) | Type safety across client/server boundary, catches API contract issues at compile time |
| **Styling** | Tailwind CSS v4 | Utility-first, zero runtime cost, design tokens via CSS custom properties |
| **Components** | Custom components + Radix primitives | No heavy component library — only `@radix-ui/react-slot` for composability, `class-variance-authority` for variants |
| **Icons** | Lucide React | Tree-shakeable, consistent design, matches landing page |
| **Auth** | jose (JWT) | Lightweight, no native deps, handles JWE/JWS — no need for next-auth overhead with custom Onfly OAuth |
| **Database** | SQLite via better-sqlite3 | Zero config, synchronous API, WAL mode for concurrent reads, perfect for demo/MVP |
| **AI** | Anthropic Claude API (Sonnet) | Best cost/performance for structured JSON output, reliable for itinerary generation |
| **HTTP Client** | Native fetch | No axios needed — built-in, lighter, works in both server and edge |

## Architecture

```
Browser → Next.js App Router → API Routes → External APIs
                                    ↓
                                SQLite DB
```

**All external API calls go through Next.js API routes** — never from the client. This keeps tokens server-side and provides a clean proxy layer.

### Data Flow

1. **Auth**: Browser → `/api/auth/onfly` → Onfly OAuth → callback → JWT cookie
2. **Calendar**: Browser → `/api/auth/google` → Google OAuth → callback → tokens in SQLite
3. **Scan**: Browser → `/api/calendar/events` → Google Calendar API → events list
4. **Filter**: Browser → `/api/itinerary/filter` → Claude API → travel-worthy events
5. **Itinerary**: Browser → `/api/itinerary/generate` → Claude API → full itinerary JSON
6. **Book**: Browser → `/api/calendar/create` → Google Calendar write → events created

## Folder Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (fonts, theme, metadata)
│   ├── page.tsx                  # Login / redirect to dashboard
│   ├── dashboard/page.tsx        # Main itinerary view (server component)
│   ├── onboarding/page.tsx       # Preferences wizard (server component)
│   └── api/
│       ├── auth/onfly/           # Onfly OAuth init + callback
│       ├── auth/google/          # Google OAuth init + callback
│       ├── auth/logout/          # Session cleanup
│       ├── calendar/events/      # Fetch Google Calendar events
│       ├── calendar/create/      # Write events to Google Calendar
│       ├── onfly/search-flights/ # Proxy Onfly flight search
│       ├── onfly/search-hotels/  # Proxy Onfly hotel search
│       ├── itinerary/generate/   # Claude AI itinerary generation
│       ├── itinerary/filter/     # Claude AI event filtering
│       └── preferences/          # CRUD user preferences
├── components/
│   ├── ui/                       # Base components (Button, Card, Input)
│   ├── layout/Navbar.tsx         # Sticky top nav
│   ├── dashboard/                # Dashboard-specific components
│   ├── onboarding/               # Onboarding wizard
│   └── LoginPage.tsx             # Landing/login page
├── lib/
│   ├── auth.ts                   # JWT session management
│   ├── db.ts                     # SQLite connection + migrations + helpers
│   ├── onfly.ts                  # Onfly API client (auth, search)
│   ├── google-calendar.ts        # Google Calendar API client
│   ├── claude.ts                 # Claude AI for itinerary generation
│   └── utils.ts                  # cn() utility
└── types/
    └── index.ts                  # All TypeScript types
```

## Key Decisions

1. **No next-auth** — Onfly has a non-standard OAuth flow (hash-fragment routing). Custom implementation is cleaner and more reliable than fighting next-auth adapters.

2. **SQLite over Supabase** — Zero network latency, zero config, WAL mode handles concurrent reads. For a demo, this is faster to set up and more reliable than an external DB.

3. **Server components by default** — Only `"use client"` on interactive components (wizard, dashboard state). Pages fetch data server-side and pass to client components.

4. **Claude for both filtering and planning** — AI handles two tasks: (1) filtering which calendar events require travel, (2) generating full itineraries. This is more reliable than regex/rules for detecting travel intent.

5. **Deep links over booking flow** — Instead of implementing checkout, we redirect to Onfly/OnHappy with pre-filled parameters. Less code, fewer API calls, same user outcome.

## Running the Project

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in ONFLY_CLIENT_ID, ONFLY_CLIENT_SECRET, GOOGLE_CLIENT_ID, etc.

# Start dev server
npm run dev
```

The SQLite database is created automatically on first request at `data/ontime.db`.

## Ports

| Service | Port |
|---------|------|
| Next.js dev | 3000 |

## Cost Estimates

| Operation | Provider | Est. Cost |
|-----------|----------|-----------|
| Event filtering (per scan) | Claude Sonnet | ~$0.003 (1K tokens in, 200 tokens out) |
| Itinerary generation (per trip) | Claude Sonnet | ~$0.015 (2K tokens in, 1K tokens out) |
| Google Calendar read | Google | Free (within daily quota) |
| Google Calendar write | Google | Free (within daily quota) |
| Onfly API calls | Onfly | Free (authenticated user) |

**Monthly estimate for active user (20 trips/month):** ~$0.36 in Claude API costs.
