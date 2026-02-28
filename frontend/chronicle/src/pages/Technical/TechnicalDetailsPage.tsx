import { Link } from "react-router-dom";
import { ArrowLeft, FileCode, ShieldAlert, Sparkles, Swords } from "lucide-react";
import { Card } from "@/components/ui/Card/Card";

interface TechnicalLink {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

const TECHNICAL_LINKS: TechnicalLink[] = [
  {
    title: "Extra Attack Spells",
    description: "Generated list of spells that grant extra attacks",
    href: "/technical/extra-attack-spells",
    icon: <Swords className="h-4 w-4" />,
  },
  {
    title: "Vulnerability Spells",
    description: "Generated list of spells that modify damage percent taken by school",
    href: "/technical/vulnerability-spells",
    icon: <ShieldAlert className="h-4 w-4" />,
  },
  {
    title: "Periodic Spells",
    description: "List of all spells with periodic effects (DoTs, HoTs, channeled, etc.)",
    href: "/technical/periodic-spells",
    icon: <Sparkles className="h-4 w-4" />,
  },
];

export function TechnicalDetailsPage() {
  return (
    <div className="container mx-auto px-4 py-4 max-w-3xl">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Home
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <FileCode className="h-5 w-5" />
        <h1 className="text-xl font-bold">Technical Details</h1>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Data dumps from Chronicle's game database.
      </p>

      <div className="space-y-2">
        {TECHNICAL_LINKS.map((link) => (
          <Link key={link.href} to={link.href}>
            <Card className="p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="text-primary">{link.icon}</div>
                <div>
                  <h2 className="text-sm font-medium">{link.title}</h2>
                  <p className="text-xs text-muted-foreground">{link.description}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
