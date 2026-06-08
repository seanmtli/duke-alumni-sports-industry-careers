# Duke Sports Alumni Directory — Project Brief

## Purpose

Build an interactive web-based directory of Duke University alumni working across the sports industry. The directory serves as a networking and discovery tool for Duke alumni and the broader Duke sports community to find and connect with fellow alumni across sports leagues, teams, startups, sports tech, sports gambling, media, and sports-facing roles at major tech/infrastructure companies.

This is a personal/community project — not a commercial product. The initial audience is Duke alumni interested in sports careers, networking, and mentorship.

---

## Core Concept

A searchable, filterable directory of Duke alumni in the sports industry, with individual profile cards and a summary dashboard. Think: a curated LinkedIn for Duke × Sports.

---

## Users

- **Primary:** Duke alumni working in or exploring the sports industry who want to discover who else from Duke is in their corner of the ecosystem.
- **Secondary:** Current Duke students or recent grads exploring sports careers who want to see the landscape of where alumni have landed.
- **Tertiary:** The person maintaining the directory (initially the creator), who needs easy workflows for adding, editing, and tagging profiles.

---

## Data Model

Each alumni record should capture the following. Not all fields will be populated for every person — the schema should be tolerant of sparse data.

### Person

| Field | Description | Example |
|---|---|---|
| `name` | Full name | Jane Smith |
| `grad_year` | Graduation year (undergrad or most relevant Duke degree) | 2015 |
| `school` | Duke school/college | Trinity, Pratt, Fuqua, Sanford, Law, etc. |
| `degree` | Degree type | BA, BS, MBA, JD, MPP, PhD |
| `major` | Major or concentration (if known) | Economics, Computer Science |
| `current_company` | Current employer | SeatGeek |
| `current_title` | Current role/title | VP of Product |
| `company_type` | Type of organization | Startup, League, Team, Big Tech, Consulting, VC/PE, Media, Agency |
| `sub_industries` | One or more sub-industry tags (see taxonomy) | ["Ticketing", "Fan Experience"] |
| `years_experience` | Approximate years of professional experience (can be derived from grad year) | 10 |
| `seniority_level` | General seniority band | Entry, Mid, Senior, VP/Director, C-Suite/Exec |
| `linkedin_url` | LinkedIn profile URL | https://linkedin.com/in/janesmith |
| `location` | City / metro area | New York, NY |
| `headshot_url` | Optional profile photo URL | (URL or null) |
| `sports_league_affiliation` | If they work for a team/league, which one | NBA, NFL, MLS, etc. |
| `added_date` | When the record was added | 2026-04-07 |
| `last_verified` | When the record was last confirmed accurate | 2026-04-07 |

---

## Sub-Industry Taxonomy

The directory should tag each person with one or more of the following sub-industries. This taxonomy should be displayed as filterable categories in the UI.

| Sub-Industry | Description / Scope |
|---|---|
| **Fan Data / CDP** | Customer data platforms, fan analytics, audience segmentation, identity resolution |
| **Ticketing** | Primary and secondary ticketing platforms, dynamic pricing, access control |
| **Sponsorship & Partnerships** | Sponsorship tech, brand-team partnerships, sponsorship measurement and valuation |
| **Sports Gambling / Betting** | Sportsbooks, betting platforms, odds/data providers, responsible gaming |
| **Media & Broadcasting** | Sports media companies, streaming, broadcast tech, content production, rights |
| **Sports Analytics** | On-field/on-court performance analytics, player evaluation, coaching tech |
| **Fan Experience & Engagement** | Loyalty platforms, gamification, second-screen apps, fan communities |
| **Venue & Event Tech** | Stadium operations, smart venues, concessions tech, event management |
| **Athlete Tech** | Wearables, health/recovery, NIL platforms, athlete marketplaces |
| **Sports at Big Tech** | Sports-facing roles at companies like Amazon, Apple, Google, Databricks, Microsoft, Meta |
| **League / Team Front Office** | Business operations roles within professional or collegiate sports organizations |
| **VC / PE / Investment in Sports** | Venture capital, private equity, investment banking focused on sports deals |
| **Sports Consulting** | Management consulting practices focused on sports (Deloitte, McKinsey, etc.) |
| **Esports & Gaming** | Competitive gaming organizations, esports platforms, gaming infrastructure |
| **Sports Data Infrastructure** | Data feeds, APIs, sports data providers (Sportradar, Genius Sports, Stats Perform, etc.) |
| **Collegiate / Amateur Sports** | NCAA administration, NIL compliance, college athletics technology |
| **Fitness & Wellness Tech** | Connected fitness, wellness platforms, sports-adjacent health tech |

This taxonomy will evolve. The app should make it easy to add or rename sub-industries without restructuring data.

---

## Core Features

### 1. Searchable Directory
- Full-text search across name, company, title
- Filter by: sub-industry (multi-select), company type, school, grad year range, seniority level, location
- Sort by: name, grad year, company, seniority
- Results displayed as profile cards with key info visible at a glance

### 2. Profile Cards
- Each person gets a card/detail view showing all populated fields
- LinkedIn link as primary external action
- Visual indicator of sub-industry tags (color-coded chips or badges)

### 3. Summary Stats / Dashboard
- Total alumni count
- Breakdown by sub-industry, company type, grad year decade
- Top companies represented
- Geographic distribution

### 4. Admin / Data Entry (v1 can be simple)
- A way to add, edit, and delete records
- Could be as simple as editing a JSON/CSV file for v1, or a basic admin form
- Ability to bulk import from CSV

---

## Design & UX Notes

- Clean, modern, and professional — this will be shared in alumni circles, so it should feel polished
- Duke branding is welcome but subtle (Duke Blue #003087 as an accent color, not a full theme)
- Mobile-responsive — people will share links and open on phones
- Fast filtering and search — the dataset will likely be in the hundreds, not thousands, so client-side filtering is fine
- Minimal onboarding — a first-time visitor should immediately understand what this is and be able to explore

---

## Tech Stack Considerations

No specific stack is prescribed. The creator has experience with Python (data science), and the project should be buildable with modern web tooling. Some context that may inform choices:

- The dataset is small enough (hundreds of records) that a database may be overkill for v1 — a JSON file or lightweight solution is fine
- The app should be easy to deploy and share (Vercel, Netlify, or similar)
- If a framework is used, React or Next.js are preferred given the interactive requirements

---

## Key Reference Points

- The creator has deep knowledge of the sports tech competitive landscape (Fan Data/CDP, Sponsorship Tech, Ticketing, Sports Data Infrastructure, AI in Sports, etc.) and can validate taxonomy and tagging decisions.
- Crustdata is already in the creator's toolchain — it's been used for contact enrichment and audience discovery in a professional context, and the Crustdata MCP has been set up in Claude Code CLI via Composio.
- The sub-industry taxonomy is informed by a comprehensive sports tech market research effort that evaluated companies through a Build / Buy / Channel Partner lens across these same categories.
