# Chronicle

**Game-play performance analysis for Classic World of Warcraft**

Chronicle transforms complex raid logs into clear, accessible insights for raid leaders and guilds on the Turtle WoW server. Unlike existing tools, Chronicle prioritizes readability, contribution clarity, and actionable feedback over raw metrics.


> **Note:** Chronicle is source-available for transparency and contribution, but is not open source. See [LICENSE](LICENSE) for details.

## Features

- **Raid log uploads** — Manual upload with guild-based archive
- **Core metrics** — Damage, healing, overhealing, and consumable usage
- **Leadership-focused** — Designed to help raid leaders coach effectively
- **Accessible** — Lower learning curve than existing alternatives

## Tech Stack

- **Backend:** Go
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Auth:** OAuth (Discord)

## Development

```bash
# Backend (runs on :3000)
make develop

# Frontend with hot reload (proxies to backend)
cd frontend/chronicle
pnpm install
pnpm dev
```
