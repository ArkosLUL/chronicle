import { Link } from "react-router-dom";
import { DiscordIcon } from "@/components/icons/DiscordIcon";


const DISCORD_URL = "https://discord.gg/gz97ABFVAj";
const PATREON_URL = "https://www.patreon.com/cw/ChronicleClassic";
const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/chronicleclassic";
const BUY_ME_A_COFFEE_ICON_URL =
  "https://cdn.brandfetch.io/idiZkYjDE2/w/192/h/192/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1708787601888";
const PATREON_ICON_URL =
  "https://cdn.brandfetch.io/id5ZYO6A-6/theme/light/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1697549446035";
const PATREON_TOOLTIP =
  "Finantial contributions are greatly appreciated, but never required. Visit the patreon link to learn more!";

export function Footer() {
  const gitTag = document
    .querySelector("meta[property=GitTag]")
    ?.getAttribute("content");

  const gitCommit = document
    .querySelector("meta[property=GitCommit]")
    ?.getAttribute("content");

  const buildTime = document
    .querySelector("meta[property=BuildTime]")
    ?.getAttribute("content");

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Navigation */}
          <div>
            <h4 className="font-semibold mb-3">Navigation</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/contact" className="hover:text-foreground transition-colors">
                  About & Contact
                </Link>
              </li>
              <li>
                <Link to="/supported" className="hover:text-foreground transition-colors">
                  Supported Instances
                </Link>
              </li>
              <li>
                <Link to="/technical" className="hover:text-foreground transition-colors">
                  Technical Details
                </Link>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="font-semibold mb-3">Community</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <DiscordIcon className="h-4 w-4" />
                  Discord
                </a>
              </li>
              <li className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                Contribute Support
              </li>
              <li>
                <a
                  href={PATREON_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={PATREON_TOOLTIP}
                  className="hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <img
                    src={PATREON_ICON_URL}
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                  Patreon
                </a>
              </li>
              <li>
                <a
                  href={BUY_ME_A_COFFEE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <img
                    src={BUY_ME_A_COFFEE_ICON_URL}
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                  Buy Me a Coffee
                </a>
              </li>
            </ul>
          </div>

          {/* Legal/Build */}
          <div className="text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Chronicle</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <Link
                to="/privacy"
                className="hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="hover:text-foreground transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                to="/disclaimer"
                className="hover:text-foreground transition-colors"
              >
                Disclaimer
              </Link>
            </div>
            <p className="text-xs mt-2">
              {gitTag} ({gitCommit}) • Built {buildTime}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
