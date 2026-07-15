# Duke Sports Alumni Directory

A searchable, filterable directory of Duke University alumni working across the sports industry — from pro leagues and front offices to sports tech startups, media, betting, and sports-facing roles at major tech companies.

**Live site:** [dukesportsalumni.com](https://www.dukesportsalumni.com/)

---

## What it is

500+ verified alumni profiles, each tagged with sub-industry, seniority, company type, and location. Built as a networking and discovery tool for Duke alumni and students interested in sports careers.

**Directory features:**
- Full-text search across name, company, and title
- Filter by sub-industry (17 categories), company type, school, grad year range, seniority, and location
- Profile cards with LinkedIn links, role, company, and sub-industry tags
- Stats dashboard with breakdowns by sub-industry, company type, and grad year cohort

**Sub-industry taxonomy** covers: Fan Data/CDP, Ticketing, Sponsorship & Partnerships, Sports Gambling, Media & Broadcasting, Sports Analytics, Fan Experience, Venue & Event Tech, Athlete Tech, Sports at Big Tech, League/Team Front Office, VC/PE, Sports Consulting, Esports, Sports Data Infrastructure, Collegiate/Amateur Sports, and Fitness & Wellness Tech.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui, Radix Base UI |
| Search | Fuse.js (client-side fuzzy search) |
| Charts | Recharts |
| Database | Supabase (Postgres) |
| Deployment | Railway |

---

## Local development

**Prerequisites:** Node.js 20+, a Supabase project, environment variables (see below).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Required environment variables** (create a `.env.local` at the project root):

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY=
```

`NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY` is your Logo.dev publishable key (`pk_…`). It powers employer logos on the home page belt and stats page via `img.logo.dev`. See `.env.example`.

The directory page is statically generated at build time from the Supabase `people` table (status = `verified`). Running `npm run dev` will fetch live data from Supabase on each request in development mode.

---

## Project structure

```
src/
  app/
    directory/     # main alumni directory
    stats/         # summary dashboard
    admin/         # record management (auth-gated)
    submit/        # alumni self-submission form
    contact/       # contact page
  components/      # shared UI components
  hooks/           # React hooks (filtering, search)
  lib/             # Supabase client, utilities
  types/           # TypeScript types
scripts/           # data pipeline (Crustdata discovery + Supabase import)
```
