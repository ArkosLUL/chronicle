<p align="center">
  <a href="http://chronicleclassic.com/">
    <img src="frontend/chronicle/public/c/chronicle/ChronicleLogoCenter.svg" alt="Chronicle" width="320" />
  </a>
</p>

<h3 align="center">Combat log analysis for Classic World of Warcraft</h3>

<p align="center">
  <a href="http://chronicleclassic.com/">chronicleclassic.com</a>
</p>

---

Chronicle transforms raid logs into a live, interactive breakdown of everything that happened in your raid.

<video src="https://github.com/Emyrk/chronicle/raw/refs/heads/readme/.github/assets/overview.webm" autoplay loop muted playsinline width="800"></video>

## Features

<!-- screenshot: live playback in action — panels animating with a YouTube video embedded and synced -->

🎬 **Live Playback** — Replay logs in real time with animated meters. Link a YouTube video and it syncs automatically — switch fights and the video seeks to match.

🔍 **Custom Filters** — Filter any panel by ability, school, hit type, source, target, and more. [See it in action →](https://chrn.link/1WyKHE)

<!-- screenshot: filtered panels — e.g. the mainhand vs offhand comparison from chrn.link/1WyKHE -->

🔗 **Shareable Links** — Every view is URL-encoded — encounters, filters, layout, time range. Copy the link and anyone sees exactly what you see.

📐 **Customizable Layouts** — Resize, rearrange, and swap panels. Save layouts and share them with your guild.

<!-- screenshot: a custom layout with several resized/rearranged panels -->

⏱️ **Time Range Selection** — Drag-select on the timeline to filter every panel to that slice.

<!-- screenshot: timeline with a drag-selected time range -->

🎒 **Loot & Gear** — See what dropped and inspect player gear from the log.

⚔️ **Class-Specific Panels** — Sunder Armor uptime, debuff tracking, and more.

---

## Development

```bash
make services-up -d
# Backend (runs on :4000)
make develop

# Frontend with hot reload (proxies to backend)
cd frontend/chronicle
pnpm install
pnpm dev
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Go |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Database | PostgreSQL |
| Auth | OAuth (Discord) |

> **Note:** Chronicle is source-available for transparency and contribution, but is not open source. See [LICENSE](LICENSE) for details.
