import { useState, useMemo } from "react";
import {
  useRetentionPolicies,
  useUpsertRetentionPolicy,
  useDeleteRetentionPolicy,
  useUpsertRetentionRule,
  useDeleteRetentionRule,
  useRetentionPreview,
  useRetentionRun,
  useAzerothcoreServers,
} from "@/api/queries";
import type { RetentionPolicy, RetentionRule, RetentionPreviewResponse, WoWServer, WoWServerRealm } from "@/api/typesGenerated";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Plus,
  Play,
  Eye,
  Loader2,
  Shield,
  ShieldOff,
  ChevronDown,
  ChevronRight,
  Clock,
  Archive,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";

// -- Condition types for the rule builder --
type Condition = {
  type: string;
  combinator?: string;
  negate?: boolean;
  days?: number;
  names?: string[];
  top_n?: number;
};

const CONDITION_TYPES = [
  { value: "age", label: "Age (days)" },
  { value: "instance_name", label: "Instance Name" },
  { value: "top_guild_speedrun", label: "Top Guild Speedrun" },
];

// -- Main Page --

export function RetentionPage() {
  const { data: policies, isLoading, error } = useRetentionPolicies();
  const { data: servers } = useAzerothcoreServers();
  const runMutation = useRetentionRun();
  const [showAddPolicy, setShowAddPolicy] = useState(false);

  // Build realm lookup from servers
  const { serverMap, realmMap } = useMemo(() => {
    const sMap = new Map<string, WoWServer>();
    const rMap = new Map<string, { realm: WoWServerRealm; server: WoWServer }>();
    if (servers) {
      for (const s of servers) {
        sMap.set(s.id, s);
        // Realms are fetched per-server; we'll show server names for now
      }
    }
    return { serverMap: sMap, realmMap: rMap };
  }, [servers]);

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-destructive">Error loading retention policies: {String(error)}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="h-6 w-6" />
            Log Retention
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure automatic log pruning per server or realm.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runMutation.mutate(true)}
            disabled={runMutation.isPending}
          >
            {runMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            Dry Run
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("Run retention now? This will delete matching logs.")) {
                runMutation.mutate(false);
              }
            }}
            disabled={runMutation.isPending}
          >
            <Play className="h-4 w-4 mr-1" />
            Run Now
          </Button>
          <Button size="sm" onClick={() => setShowAddPolicy(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Policy
          </Button>
        </div>
      </div>

      {runMutation.isSuccess && (
        <Card className="p-3 bg-green-500/10 border-green-500/30">
          <p className="text-sm text-green-400">✓ Retention job enqueued successfully.</p>
        </Card>
      )}

      {showAddPolicy && (
        <AddPolicyForm
          servers={servers ?? []}
          onClose={() => setShowAddPolicy(false)}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !policies?.length ? (
        <Card className="p-6 text-center text-muted-foreground">
          No retention policies configured yet.
        </Card>
      ) : (
        <div className="space-y-4">
          {policies.map((policy) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              serverMap={serverMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// -- Add Policy Form --

function AddPolicyForm({
  servers,
  onClose,
}: {
  servers: WoWServer[];
  onClose: () => void;
}) {
  const upsertPolicy = useUpsertRetentionPolicy();
  const [scope, setScope] = useState<"server" | "realm">("server");
  const [selectedId, setSelectedId] = useState("");
  const [realmId, setRealmId] = useState("");
  const [realms, setRealms] = useState<WoWServerRealm[]>([]);
  const [loadingRealms, setLoadingRealms] = useState(false);

  const handleServerChange = async (serverId: string) => {
    setSelectedId(serverId);
    setRealmId("");
    if (scope === "realm" && serverId) {
      setLoadingRealms(true);
      try {
        const res = await fetch(`/api/v1/azerothcore/servers/${serverId}/realms`);
        if (res.ok) {
          setRealms(await res.json());
        }
      } finally {
        setLoadingRealms(false);
      }
    }
  };

  const handleSubmit = () => {
    const req = scope === "server"
      ? { server_id: selectedId, enabled: true }
      : { realm_id: realmId, enabled: true };
    upsertPolicy.mutate(req, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-semibold">New Retention Policy</h3>

      <div className="flex gap-4 items-center">
        <label className="text-sm text-muted-foreground">Scope:</label>
        <select
          value={scope}
          onChange={(e) => {
            setScope(e.target.value as "server" | "realm");
            setSelectedId("");
            setRealmId("");
          }}
          className="px-3 py-1.5 bg-background border rounded text-sm"
        >
          <option value="server">Server</option>
          <option value="realm">Realm</option>
        </select>
      </div>

      <div className="flex gap-4 items-center">
        <label className="text-sm text-muted-foreground">Server:</label>
        <select
          value={selectedId}
          onChange={(e) => handleServerChange(e.target.value)}
          className="px-3 py-1.5 bg-background border rounded text-sm min-w-[200px]"
        >
          <option value="">Select a server...</option>
          {servers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {scope === "realm" && selectedId && (
        <div className="flex gap-4 items-center">
          <label className="text-sm text-muted-foreground">Realm:</label>
          {loadingRealms ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <select
              value={realmId}
              onChange={(e) => setRealmId(e.target.value)}
              className="px-3 py-1.5 bg-background border rounded text-sm min-w-[200px]"
            >
              <option value="">Select a realm...</option>
              {realms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={
            upsertPolicy.isPending ||
            (scope === "server" && !selectedId) ||
            (scope === "realm" && !realmId)
          }
        >
          {upsertPolicy.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Create Policy
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {upsertPolicy.isError && (
        <p className="text-sm text-destructive">{String(upsertPolicy.error)}</p>
      )}
    </Card>
  );
}

// -- Policy Card --

function PolicyCard({
  policy,
  serverMap,
}: {
  policy: RetentionPolicy;
  serverMap: Map<string, WoWServer>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const deleteMutation = useDeleteRetentionPolicy();
  const upsertPolicy = useUpsertRetentionPolicy();
  const previewMutation = useRetentionPreview();

  const scopeLabel = policy.server_id
    ? `Server: ${serverMap.get(policy.server_id)?.name ?? policy.server_id}`
    : `Realm: ${policy.realm_id ?? "unknown"}`;

  const toggleEnabled = () => {
    upsertPolicy.mutate({
      server_id: policy.server_id ?? undefined,
      realm_id: policy.realm_id ?? undefined,
      enabled: !policy.enabled,
    });
  };

  const handlePreview = () => {
    if (policy.realm_id) {
      previewMutation.mutate({ realm_id: policy.realm_id });
      setShowPreview(true);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{scopeLabel}</span>
            {policy.enabled ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-green-500/15 text-green-500">
                <Shield className="h-3 w-3" /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">
                <ShieldOff className="h-3 w-3" /> Disabled
              </span>
            )}
          </div>
          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
            <span>{policy.rules?.length ?? 0} rules</span>
            <span>Deleted: {policy.total_deleted.toLocaleString()}</span>
            <span>Kept: {policy.total_kept.toLocaleString()}</span>
            {policy.last_run_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last run: {new Date(policy.last_run_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleEnabled}
            disabled={upsertPolicy.isPending}
            title={policy.enabled ? "Disable" : "Enable"}
          >
            {policy.enabled ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
          </Button>
          {policy.realm_id && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreview}
              disabled={previewMutation.isPending}
              title="Preview"
            >
              {previewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Delete this policy and all its rules?")) {
                deleteMutation.mutate(policy.id);
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Rules (evaluated top-to-bottom, first match wins)</h4>
            <Button size="sm" variant="outline" onClick={() => setShowAddRule(true)}>
              <Plus className="h-3 w-3 mr-1" /> Add Rule
            </Button>
          </div>

          {showAddRule && (
            <AddRuleForm
              policyId={policy.id}
              nextPriority={(policy.rules?.length ?? 0) + 1}
              onClose={() => setShowAddRule(false)}
            />
          )}

          {!policy.rules?.length ? (
            <p className="text-sm text-muted-foreground py-2">No rules yet. Add rules to define retention behavior.</p>
          ) : (
            <div className="space-y-2">
              {[...policy.rules].sort((a, b) => a.priority - b.priority).map((rule) => (
                <RuleRow key={rule.id} rule={rule} />
              ))}
            </div>
          )}

          {showPreview && previewMutation.data && (
            <PreviewResults data={previewMutation.data} onClose={() => setShowPreview(false)} />
          )}
        </div>
      )}
    </Card>
  );
}

// -- Rule Row --

function RuleRow({ rule }: { rule: RetentionRule }) {
  const deleteMutation = useDeleteRetentionRule();
  const conditions = parseConditions(rule.conditions);

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded text-sm">
      <span className="text-muted-foreground font-mono text-xs w-6 shrink-0">
        #{rule.priority}
      </span>

      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded uppercase ${
          rule.action === "delete"
            ? "bg-red-500/15 text-red-400"
            : "bg-green-500/15 text-green-400"
        }`}
      >
        {rule.action === "delete" ? <XCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
        {rule.action}
      </span>

      <div className="flex-1 min-w-0">
        {rule.description && (
          <span className="text-muted-foreground mr-2">{rule.description}</span>
        )}
        <span className="text-xs text-muted-foreground/70">
          {formatConditions(conditions)}
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (confirm("Delete this rule?")) {
            deleteMutation.mutate(rule.id);
          }
        }}
        disabled={deleteMutation.isPending}
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}

// -- Add Rule Form --

function AddRuleForm({
  policyId,
  nextPriority,
  onClose,
}: {
  policyId: string;
  nextPriority: number;
  onClose: () => void;
}) {
  const upsertRule = useUpsertRetentionRule();
  const [action, setAction] = useState<"keep" | "delete">("delete");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(nextPriority);
  const [conditions, setConditions] = useState<Condition[]>([]);

  const addCondition = () => {
    setConditions([
      ...conditions,
      {
        type: "age",
        combinator: conditions.length > 0 ? "and" : undefined,
        days: 90,
      },
    ]);
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const next = [...conditions];
    next[index] = { ...next[index], ...updates };
    setConditions(next);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    upsertRule.mutate(
      {
        policyId,
        priority,
        action,
        conditions: conditions.length > 0 ? conditions : [],
        description,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Card className="p-4 space-y-3 border-dashed">
      <h4 className="text-sm font-semibold">New Rule</h4>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Priority</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-background border rounded text-sm"
            min={1}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as "keep" | "delete")}
            className="w-full px-2 py-1.5 bg-background border rounded text-sm"
          >
            <option value="delete">Delete</option>
            <option value="keep">Keep</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-2 py-1.5 bg-background border rounded text-sm"
            placeholder="e.g. Delete Onyxia logs older than 30 days"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Conditions</label>
          <Button size="sm" variant="ghost" onClick={addCondition}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>

        {conditions.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No conditions = always matches (catch-all)</p>
        )}

        {conditions.map((cond, i) => (
          <ConditionEditor
            key={i}
            condition={cond}
            index={i}
            onChange={(updates) => updateCondition(i, updates)}
            onRemove={() => removeCondition(i)}
          />
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={handleSubmit} disabled={upsertRule.isPending}>
          {upsertRule.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Save Rule
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {upsertRule.isError && (
        <p className="text-sm text-destructive">{String(upsertRule.error)}</p>
      )}
    </Card>
  );
}

// -- Condition Editor --

function ConditionEditor({
  condition,
  index,
  onChange,
  onRemove,
}: {
  condition: Condition;
  index: number;
  onChange: (updates: Partial<Condition>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/20 rounded text-sm">
      {index > 0 && (
        <select
          value={condition.combinator ?? "and"}
          onChange={(e) => onChange({ combinator: e.target.value })}
          className="px-2 py-1 bg-background border rounded text-xs w-16"
        >
          <option value="and">AND</option>
          <option value="or">OR</option>
        </select>
      )}

      <label className="flex items-center gap-1 text-xs">
        <input
          type="checkbox"
          checked={condition.negate ?? false}
          onChange={(e) => onChange({ negate: e.target.checked })}
        />
        NOT
      </label>

      <select
        value={condition.type}
        onChange={(e) => {
          const type = e.target.value;
          const base: Condition = { type, combinator: condition.combinator, negate: condition.negate };
          if (type === "age") base.days = 90;
          if (type === "instance_name") base.names = [];
          if (type === "top_guild_speedrun") base.top_n = 3;
          onChange(base);
        }}
        className="px-2 py-1 bg-background border rounded text-xs"
      >
        {CONDITION_TYPES.map((ct) => (
          <option key={ct.value} value={ct.value}>{ct.label}</option>
        ))}
      </select>

      {condition.type === "age" && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{">"}</span>
          <input
            type="number"
            value={condition.days ?? 90}
            onChange={(e) => onChange({ days: Number(e.target.value) })}
            className="w-16 px-2 py-1 bg-background border rounded text-xs"
            min={1}
          />
          <span className="text-xs text-muted-foreground">days old</span>
        </div>
      )}

      {condition.type === "instance_name" && (
        <input
          type="text"
          value={(condition.names ?? []).join(", ")}
          onChange={(e) =>
            onChange({
              names: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          className="flex-1 px-2 py-1 bg-background border rounded text-xs"
          placeholder="Onyxia's Lair, Blackwing Lair"
        />
      )}

      {condition.type === "top_guild_speedrun" && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">top</span>
          <input
            type="number"
            value={condition.top_n ?? 3}
            onChange={(e) => onChange({ top_n: Number(e.target.value) })}
            className="w-14 px-2 py-1 bg-background border rounded text-xs"
            min={1}
          />
          <span className="text-xs text-muted-foreground">per guild</span>
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={onRemove} className="ml-auto">
        <Trash2 className="h-3 w-3 text-destructive" />
      </Button>
    </div>
  );
}

// -- Preview Results --

function PreviewResults({
  data,
  onClose,
}: {
  data: RetentionPreviewResponse;
  onClose: () => void;
}) {
  return (
    <Card className="p-4 space-y-3 border-amber-500/30 bg-amber-500/5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Dry-Run Preview — {data.total_evaluated} instances evaluated
        </h4>
        <Button size="sm" variant="ghost" onClick={onClose}>
          ✕
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="p-2 rounded bg-red-500/10">
          <div className="text-2xl font-bold text-red-400">{data.to_delete?.length ?? 0}</div>
          <div className="text-xs text-muted-foreground">Would Delete</div>
        </div>
        <div className="p-2 rounded bg-green-500/10">
          <div className="text-2xl font-bold text-green-400">{data.to_keep?.length ?? 0}</div>
          <div className="text-xs text-muted-foreground">Would Keep</div>
        </div>
        <div className="p-2 rounded bg-muted">
          <div className="text-2xl font-bold text-muted-foreground">{data.no_match?.length ?? 0}</div>
          <div className="text-xs text-muted-foreground">No Match (default keep)</div>
        </div>
      </div>

      {(data.to_delete?.length ?? 0) > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Show instances to delete ({data.to_delete.length})
          </summary>
          <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
            {data.to_delete.map((item) => (
              <div key={item.instance_id} className="flex items-center gap-2 px-2 py-1 bg-muted/30 rounded text-xs">
                <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                <span className="font-medium">{item.instance_name}</span>
                <span className="text-muted-foreground">{new Date(item.end_time).toLocaleDateString()}</span>
                {item.matched_rule && (
                  <span className="ml-auto text-muted-foreground/70 italic">{item.matched_rule}</span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}

// -- Helpers --

function parseConditions(raw: unknown): Condition[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Condition[];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatConditions(conditions: Condition[]): string {
  if (conditions.length === 0) return "(always matches)";

  return conditions
    .map((c, i) => {
      const prefix = i > 0 ? ` ${(c.combinator ?? "and").toUpperCase()} ` : "";
      const neg = c.negate ? "NOT " : "";
      switch (c.type) {
        case "age":
          return `${prefix}${neg}age > ${c.days}d`;
        case "instance_name":
          return `${prefix}${neg}name ∈ [${(c.names ?? []).join(", ")}]`;
        case "top_guild_speedrun":
          return `${prefix}${neg}top ${c.top_n} guild run`;
        default:
          return `${prefix}${neg}${c.type}`;
      }
    })
    .join("");
}
