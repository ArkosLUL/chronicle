import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft, Search } from "lucide-react";
import { useState } from "react";
import { useSpell } from "@/api/queries";
import { SpellTooltip } from "./SpellTooltip";

export function SpellPage() {
  const { spellId } = useParams<{ spellId: string }>();
  const [searchId, setSearchId] = useState(spellId || "");
  
  const { data: spell, isLoading, error } = useSpell(spellId || "", {
    enabled: !!spellId,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId && searchId !== spellId) {
      window.location.href = `/wowdb/spell/${searchId}`;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <h1 className="text-2xl font-bold">Spell Database</h1>
        <p className="text-muted-foreground text-sm mt-1">
          View spell data from World of Warcraft
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="number"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Enter spell ID..."
            className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            View
          </button>
        </div>
      </form>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive text-sm">
            {error instanceof Error ? error.message : "Failed to load spell"}
          </p>
        </div>
      )}

      {!isLoading && !error && !spell && spellId && (
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <p className="text-muted-foreground text-sm">
            No spell found with ID {spellId}
          </p>
        </div>
      )}

      {!spellId && (
        <div className="bg-muted/50 border border-border rounded-lg p-6 text-center">
          <p className="text-muted-foreground">
            Enter a spell ID above to view its details
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            Try: <Link to="/wowdb/spell/133" className="text-primary hover:underline">133 (Fireball)</Link>,{" "}
            <Link to="/wowdb/spell/585" className="text-primary hover:underline">585 (Smite)</Link>,{" "}
            <Link to="/wowdb/spell/100" className="text-primary hover:underline">100 (Charge)</Link>,{" "}
            <Link to="/wowdb/spell/6078" className="text-primary hover:underline">6078 (Renew)</Link>
          </p>
        </div>
      )}

      {spell && (
        <div className="space-y-6">
          {/* Tooltip Preview */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              Tooltip Preview
            </h2>
            <SpellTooltip spell={spell} />
          </div>

          {/* Raw Data */}
          <details className="bg-muted/30 border border-border rounded-lg">
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium hover:bg-muted/50">
              Raw API Response
            </summary>
            <pre className="p-4 text-xs overflow-auto max-h-96 border-t border-border">
              {JSON.stringify(spell, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
