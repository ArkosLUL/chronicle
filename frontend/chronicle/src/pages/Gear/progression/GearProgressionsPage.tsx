import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useSiteConfig } from "@/api/queries";
import {
  useCreateGearProgression,
  useDeleteGearProgression,
  useMyGearProgressions,
} from "@/api/gearProgressionQueries";
import { gearClassesForFlavor } from "../classInfo";
import { ProgressionCard } from "./ProgressionCard";
import { PROGRESSION_PAYLOAD_VERSION } from "./progressionModel";

function CreateProgressionForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const { data: siteConfig } = useSiteConfig();
  const classes = useMemo(
    () => gearClassesForFlavor(siteConfig?.dataset_flavor ?? []),
    [siteConfig?.dataset_flavor],
  );
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id ?? 1);
  const [specName, setSpecName] = useState("");
  const create = useCreateGearProgression();

  const selectedClass = classes.find((c) => c.id === classId);

  const submit = () => {
    if (!title.trim()) {
      toast.error("Give the progression a title");
      return;
    }
    create.mutate(
      {
        title: title.trim(),
        description: "",
        class_id: classId,
        spec_name: specName,
        // The generated type for json.RawMessage is awkward; the payload
        // travels as a plain JSON object.
        payload: {
          version: PROGRESSION_PAYLOAD_VERSION,
          pool: [],
          stages: [{ name: "Stage 1", slots: {} }],
        } as unknown as Record<string, string>,
      },
      {
        onSuccess: (prog) => {
          onDone();
          navigate(`/gear/progression/${prog.id}`);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const selectClass =
    "h-9 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-200";

  return (
    <div className="space-y-3 rounded-md border border-zinc-700/60 bg-zinc-900/40 p-4">
      <Input
        placeholder="Progression title, e.g. Pre-Raid BiS"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={128}
        autoFocus
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={selectClass}
          value={classId}
          onChange={(e) => {
            setClassId(Number(e.target.value));
            setSpecName("");
          }}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={specName}
          onChange={(e) => setSpecName(e.target.value)}
        >
          <option value="">Any spec</option>
          {(selectedClass?.specs ?? []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={create.isPending}>
          Create
        </Button>
      </div>
    </div>
  );
}

function SignedOutState() {
  const location = useLocation();
  const loginUrl = `/login?from=${encodeURIComponent(location.pathname + location.search)}`;
  return (
    <div className="flex flex-col items-center rounded-md border border-dashed border-zinc-800 px-6 py-12 text-center">
      <div className="text-sm font-semibold text-zinc-200">
        Sign in to build gear progressions
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Plan a sequence of gear stages for your characters.
      </p>
      <Link to={loginUrl} className="mt-4">
        <Button size="sm">Sign in</Button>
      </Link>
    </div>
  );
}

/** "My progressions" — the index for the Progression tab. */
export function GearProgressionsPage() {
  const { isAuthenticated } = useAuth();
  const [creating, setCreating] = useState(false);
  const mine = useMyGearProgressions(isAuthenticated);
  const remove = useDeleteGearProgression();

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h2 className="font-wow text-lg text-zinc-100">My progressions</h2>
            {isAuthenticated && !mine.isLoading && (
              <span className="text-xs text-zinc-500">
                {(mine.data ?? []).length} saved
              </span>
            )}
          </div>
          {isAuthenticated && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-4 w-4" />
              New
            </Button>
          )}
        </div>
        {creating && <CreateProgressionForm onDone={() => setCreating(false)} />}
        {!isAuthenticated ? (
          <SignedOutState />
        ) : mine.isLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (mine.data ?? []).length === 0 ? (
          !creating && (
            <p className="text-sm text-zinc-500">
              No progressions yet. Create one to start planning your gear stages.
            </p>
          )
        ) : (
          <div className="space-y-2">
            {(mine.data ?? []).map((prog) => (
              <ProgressionCard
                key={prog.id}
                progression={prog}
                actions={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-500 hover:text-red-400"
                    onClick={() => {
                      if (!window.confirm(`Delete "${prog.title}"? This cannot be undone.`)) return;
                      remove.mutate(prog.id, { onError: (err) => toast.error(err.message) });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
