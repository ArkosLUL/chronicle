import { useEffect, useState } from "react";
import { DiscordIcon } from "./DiscordIcon";

const DISCORD_URL = "https://discord.gg/gz97ABFVAj";

function GetInTouchModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 className="text-xl font-semibold text-foreground">
          Get in touch via Discord
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          We'd love to help bring Chronicle to you. Reach out on our Discord
          and we'll get you set up.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Chronicle is open source and{" "}
          <a
            href="https://github.com/Emyrk/chronicle/blob/main/DEPLOYING.md"
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary hover:underline"
          >
            self-hosting is fully supported
          </a>
          {" "}— run it on your own infrastructure if you prefer.
        </p>

        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <DiscordIcon className="h-4 w-4" />
          Join the Chronicle Discord
        </a>
      </div>
    </div>
  );
}

export function Hero() {
  const [open, setOpen] = useState(false);

  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Subtle radial gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--primary-darker)_0%,_transparent_60%)] opacity-40" />

      <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
        {/* Logo */}
        <img
          src="chronicle-logo.svg"
          alt="Chronicle"
          className="mx-auto mb-6 h-10 sm:h-12"
          onError={(e) => {
            // Fallback if SVG is missing: show text instead
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          Combat log analysis for{" "}
          <span className="text-primary">Classic WoW</span>
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Chronicle transforms raid logs into clear, actionable insights.
        </p>

        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <a
            href="https://github.com/Emyrk/chronicle"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </a>
          <span className="text-border">·</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="transition-colors hover:text-foreground cursor-pointer"
          >
            Run Chronicle for your server →
          </button>
        </div>
      </div>
      {open && <GetInTouchModal onClose={() => setOpen(false)} />}
    </section>
  );
}
