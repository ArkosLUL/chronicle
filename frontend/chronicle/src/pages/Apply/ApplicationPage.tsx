import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  useServerApplication,
  useCreateModificationRequest,
  useDeleteModificationRequest,
  useApproveModificationRequest,
  useRejectModificationRequest,
  useApplicationAdmins,
  useAddApplicationAdmin,
  useRemoveApplicationAdmin,
  useSyncServers,
} from "@/api/queries";
import type {
  ServerApplication,
  ModificationRequest,
  CreateModificationRequestPayload,
  Tenant,
} from "@/api/typesGenerated";
import { ThemeEditor } from "@/components/ThemeEditor/ThemeEditor";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Server,
  Globe,
  Pencil,
  Plus,
  RefreshCw,
  X,
  Users,
  Trash2,
  Info,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findRequest(
  requests: readonly ModificationRequest[],
  type: string,
): ModificationRequest | undefined {
  // Prefer pending, then rejected, then approved
  return (
    requests.find((r) => r.type === type && r.status === "pending") ??
    requests.find((r) => r.type === type && r.status === "rejected") ??
    requests.find((r) => r.type === type && r.status === "approved")
  );
}

function filterRequests(
  requests: readonly ModificationRequest[],
  type: string,
): ModificationRequest[] {
  return requests.filter((r) => r.type === type);
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-green-500/15 text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          Approved
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-red-500/15 text-red-400">
          <XCircle className="h-3 w-3" />
          Rejected
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-yellow-500/15 text-yellow-400">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// RequestBadge – status + optional admin note
// ---------------------------------------------------------------------------

function RequestBadge({ req }: { req: ModificationRequest }) {
  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={req.status} />
      {req.admin_note && (
        <span className="text-xs text-muted-foreground italic">
          &ldquo;{req.admin_note}&rdquo;
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin review controls (per-request approve/reject)
// ---------------------------------------------------------------------------

function AdminReviewControls({
  appId,
  reqId,
  status,
}: {
  appId: string;
  reqId: string;
  status: string;
}) {
  const approve = useApproveModificationRequest(appId);
  const reject = useRejectModificationRequest(appId);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  if (status !== "pending") return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showNote ? (
        <div className="flex items-center gap-2">
          <input
            className="rounded-md border bg-background px-2 py-1 text-xs w-48"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Rejection note (optional)"
          />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNote(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowNote(true)}>
          Add note
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="text-xs h-7 text-green-400 border-green-400/30"
        disabled={approve.isPending}
        onClick={() =>
          approve.mutate(reqId, {
            onSuccess: () => toast.success("Request approved"),
            onError: (err) => toast.error(err.message),
          })
        }
      >
        {approve.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-xs h-7 text-red-400 border-red-400/30"
        disabled={reject.isPending}
        onClick={() =>
          reject.mutate(
            { reqId, adminNote: note || undefined },
            {
              onSuccess: () => {
                toast.success("Request rejected");
                setNote("");
                setShowNote(false);
              },
              onError: (err) => toast.error(err.message),
            },
          )
        }
      >
        {reject.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reject"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete rejected request button
// ---------------------------------------------------------------------------

function DeleteRequestButton({ appId, reqId }: { appId: string; reqId: string }) {
  const del = useDeleteModificationRequest(appId);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs h-7 text-red-400"
      disabled={del.isPending}
      onClick={() =>
        del.mutate(reqId, {
          onSuccess: () => toast.success("Request deleted"),
          onError: (err) => toast.error(err.message),
        })
      }
    >
      {del.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3 mr-1" />Delete</>}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// ImagePreview – shows a small thumbnail when a URL is set
// ---------------------------------------------------------------------------

function ImagePreview({ url, alt }: { url: string; alt: string }) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt={alt}
      className="mt-1 h-10 w-auto rounded border border-border object-contain bg-background"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Section: Branding field card (core, slug, description, logos)
// ---------------------------------------------------------------------------

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((t) => t.trim()).filter(Boolean);
}

function TagDisplay({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-xs italic text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className="rounded-full border border-primary/50 bg-primary/15 text-primary px-2 py-0.5 text-xs font-medium">
          {t}
        </span>
      ))}
    </div>
  );
}

const BRANDING_TAGS = [
  { category: "Client", values: ["1.12", "2.4.3", "2.5.3", "3.3.5a"] },
  { category: "Version", values: ["Vanilla", "TBC", "Wrath"] },
  { category: "Style", values: ["Progression", "PvP"] },
  { category: "Extra", values: ["Custom Content"] },
  { category: "Core", values: ["Azeroth Core"] },
  { category: "Logging", values: ["Client Side", "Server Side"] },
];

function TagPicker({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const toggle = (tag: string) => {
    onChange(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  };
  return (
    <div className="space-y-1.5">
      {BRANDING_TAGS.map((group) => (
        <div key={group.category} className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground w-14 shrink-0">{group.category}</span>
          {group.values.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => toggle(v)}
              className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                tags.includes(v)
                  ? "border-primary/50 bg-primary/15 text-primary font-medium"
                  : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

const BRANDING_SECTIONS = [
  {
    type: "core" as const,
    label: "Core Info",
    description: "A universal name for you or your team. This identifies your group to other players. If you only have one server, this name is likely to be the same as the server name.",
    fields: [
      { key: "name", label: "Server Name" },
      { key: "display_name", label: "Display Name" },
      { key: "tagline", label: "Tagline" },
      { key: "tags", label: "Tags", tags: true },
    ],
    getLive: (tenant: { name?: string; branding?: { display_name?: string; tagline?: string; tags?: readonly string[] } | null }) => ({
      name: tenant.name ?? "",
      display_name: tenant.branding?.display_name ?? "",
      tagline: tenant.branding?.tagline ?? "",
      tags: (tenant.branding?.tags ?? []).join(", "),
    }),
  },
  {
    type: "slug" as const,
    label: "Slug",
    description: "Applying for a slug generates a URL specific to your server. Your slug becomes your subdomain — for example, your-slug.chronicleclassic.com. This domain will serve only your logs, your armory, etc.",
    fields: [{ key: "slug", label: "URL Slug" }],
    getLive: (tenant: { slug?: string | null }) => ({
      slug: tenant.slug ?? "",
    }),
  },
  {
    type: "description" as const,
    label: "Description",
    fields: [
      { key: "description", label: "Description", multiline: true },
      { key: "website_url", label: "Website URL" },
    ],
    getLive: (tenant: { branding?: { description?: string } | null }) => ({
      description: tenant.branding?.description ?? "",
      website_url: "",
    }),
  },
  {
    type: "logos" as const,
    label: "Logos",
    description: "Logos bring your own branding to your logs. Requires an approved slug to take effect.",
    fields: [
      { key: "square_logo", label: "Square Logo URL", image: true },
      { key: "logo_wide", label: "Wide Logo URL", image: true },
      { key: "favicon", label: "Favicon URL", image: true },
      { key: "background_banner", label: "Background Banner URL", image: true },
    ],
    getLive: (tenant: { branding?: { square_logo?: string; logo_wide?: string; favicon?: string; background_banner?: string } | null }) => ({
      square_logo: tenant.branding?.square_logo ?? "",
      logo_wide: tenant.branding?.logo_wide ?? "",
      favicon: tenant.branding?.favicon ?? "",
      background_banner: tenant.branding?.background_banner ?? "",
    }),
  },
] as const;

function BrandingSectionCard({
  section,
  appId,
  requests,
  tenant,
  canReview,
}: {
  section: (typeof BRANDING_SECTIONS)[number];
  appId: string;
  requests: readonly ModificationRequest[];
  tenant: Tenant;
  canReview: boolean;
}) {
  const req = findRequest(requests, section.type);
  const createReq = useCreateModificationRequest(appId);
  const [editing, setEditing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const live = (section.getLive as (t: any) => Record<string, string>)(tenant);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    req ? { ...req.payload } : { ...live },
  );

  const handleSave = () => {
    const payload: CreateModificationRequestPayload = {
      type: section.type,
      payload: draft,
    };
    createReq.mutate(payload, {
      onSuccess: () => {
        toast.success("Request saved");
        setEditing(false);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{section.label}</h3>
        {req && <RequestBadge req={req} />}
      </div>
      {"description" in section && section.description && (
        <p className="text-xs text-muted-foreground">{section.description}</p>
      )}

      {/* Live values */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium">Current (live)</p>
        {section.fields.map((f) => (
          <div key={f.key} className="flex items-start gap-2 text-xs">
            <span className="text-muted-foreground w-32 shrink-0 pt-0.5">{f.label}:</span>
            {"tags" in f && f.tags
              ? <TagDisplay tags={parseTags(live[f.key])} />
              : <span className="truncate">{live[f.key] || <span className="italic text-muted-foreground">—</span>}</span>
            }
          </div>
        ))}
      </div>

      {/* Pending/rejected request details */}
      {req && req.status !== "approved" && !editing && (
        <div className="space-y-1 border-t pt-2">
          <p className="text-xs text-muted-foreground font-medium">Requested changes</p>
          {section.fields.map((f) => {
            const val = req.payload[f.key] ?? "";
            return (
              <div key={f.key} className="flex items-start gap-2 text-xs">
                <span className="text-muted-foreground w-32 shrink-0 pt-0.5">{f.label}:</span>
                {"tags" in f && f.tags
                  ? <TagDisplay tags={parseTags(val)} />
                  : <span className="truncate">{val || "—"}</span>
                }
                {"image" in f && f.image && <ImagePreview url={val} alt={f.label} />}
              </div>
            );
          })}
          <div className="flex items-center gap-2 pt-1">
            {req.status === "pending" && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setDraft({ ...req.payload }); setEditing(true); }}>
                Edit
              </Button>
            )}
            {req.status === "rejected" && <DeleteRequestButton appId={appId} reqId={req.id} />}
            {canReview && <AdminReviewControls appId={appId} reqId={req.id} status={req.status} />}
          </div>
        </div>
      )}

      {editing && (
        <div className="space-y-2 border-t pt-2">
          <p className="text-xs text-muted-foreground font-medium">Edit request</p>
          {section.fields.map((f) => (
            <div key={f.key}>
              <label className="text-xs text-muted-foreground">{f.label}</label>
              {"tags" in f && f.tags ? (
                <TagPicker
                  tags={parseTags(draft[f.key])}
                  onChange={(tags) => setDraft({ ...draft, [f.key]: tags.join(",") })}
                />
              ) : "multiline" in f && f.multiline ? (
                <textarea
                  className="w-full rounded-md border bg-background px-2 py-1 text-sm mt-0.5 min-h-[60px]"
                  value={draft[f.key] ?? ""}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                />
              ) : (
                <>
                  <input
                    className="w-full rounded-md border bg-background px-2 py-1 text-sm mt-0.5"
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  />
                  {"image" in f && f.image && <ImagePreview url={draft[f.key] ?? ""} alt={f.label} />}
                </>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" className="text-xs h-7" disabled={createReq.isPending} onClick={handleSave}>
              {createReq.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {(!req || req.status === "approved") && !editing && (
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setDraft({ ...live }); setEditing(true); }}>
          <Plus className="h-3 w-3 mr-1" /> Request change
        </Button>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Theme section (uses ThemeEditor)
// ---------------------------------------------------------------------------

/** Safely parse a theme value that may be an object, a JSON string, or junk.
 *  Strips numeric-indexed keys that result from corrupted string-to-map conversion. */
function parseTheme(raw: unknown): Record<string, string> {
  let v = raw;
  while (typeof v === "string") {
    try { v = JSON.parse(v); } catch { return {}; }
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const obj = v as Record<string, string>;
    const clean: Record<string, string> = {};
    for (const [k, val] of Object.entries(obj)) {
      // Skip numeric keys (junk from string-to-map corruption like "0", "10", "42")
      if (typeof val === "string" && !/^\d+$/.test(k)) {
        clean[k] = val;
      }
    }
    return clean;
  }
  return {};
}

function ThemePreview({ label, theme }: { label: string; theme: unknown }) {
  const parsed = parseTheme(theme);
  const entries = Object.entries(parsed).filter(
    ([key, val]) => typeof key === "string" && key.length > 1 && typeof val === "string"
  );
  return (
    <div>
      <p className="text-xs text-muted-foreground font-medium mb-2">{label}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No colors set</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs">
              <div className="h-3 w-3 rounded-full border" style={{ backgroundColor: value }} />
              <span className="text-muted-foreground">{key}:</span>
              <span className="font-mono">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeSectionCard({
  appId,
  requests,
  tenant,
  canReview,
}: {
  appId: string;
  requests: readonly ModificationRequest[];
  tenant: Tenant;
  canReview: boolean;
}) {
  const req = findRequest(requests, "theme");
  const createReq = useCreateModificationRequest(appId);
  const [editing, setEditing] = useState(false);
  const liveTheme = parseTheme(tenant.branding?.theme);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    req?.payload?.theme ? parseTheme(req.payload.theme) : { ...liveTheme },
  );

  const handleSave = () => {
    createReq.mutate(
      { type: "theme", payload: { theme: draft } },
      {
        onSuccess: () => {
          toast.success("Theme request saved");
          setEditing(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Theme</h3>
        {req && <RequestBadge req={req} />}
      </div>
      <p className="text-xs text-muted-foreground">
        Theming creates a custom color palette for your site. Requires an approved slug to take effect.
      </p>

      {editing ? (
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-2">Edit theme</p>
          <ThemeEditor value={draft} onChange={setDraft} />
          <div className="flex gap-2 mt-2">
            <Button size="sm" className="text-xs h-7" disabled={createReq.isPending} onClick={handleSave}>
              {createReq.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <ThemePreview label="Current theme" theme={liveTheme} />
      )}

      {req && !editing && req.status === "pending" && (
        <ThemePreview label="Pending changes" theme={req.payload?.theme ?? {}} />
      )}

      {req && !editing && (
        <div className="flex items-center gap-2 pt-1 border-t">
          {req.status === "pending" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setDraft(parseTheme(req.payload?.theme));
                setEditing(true);
              }}
            >
              Edit
            </Button>
          )}
          {req.status === "rejected" && <DeleteRequestButton appId={appId} reqId={req.id} />}
          {canReview && <AdminReviewControls appId={appId} reqId={req.id} status={req.status} />}
        </div>
      )}

      {!editing && (!req || req.status !== "pending") && (
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setDraft({ ...liveTheme }); setEditing(true); }}>
          <Plus className="h-3 w-3 mr-1" /> Request theme change
        </Button>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Settings section (boolean toggles)
// ---------------------------------------------------------------------------

function SettingsSectionCard({
  appId,
  requests,
  tenant,
  canReview,
}: {
  appId: string;
  requests: readonly ModificationRequest[];
  tenant: Tenant;
  canReview: boolean;
}) {
  const req = findRequest(requests, "settings");
  const createReq = useCreateModificationRequest(appId);
  const [editing, setEditing] = useState(false);
  const [includeInAll, setIncludeInAll] = useState(tenant.include_in_all);
  const [disableClientUpload, setDisableClientUpload] = useState(tenant.disable_client_upload);
  const [discoverable, setDiscoverable] = useState(tenant.discoverable);

  const handleSave = () => {
    createReq.mutate(
      {
        type: "settings",
        payload: {
          include_in_all: includeInAll,
          disable_client_upload: disableClientUpload,
          discoverable: discoverable,
        } as never,
      },
      {
        onSuccess: () => {
          toast.success("Settings change requested");
          setEditing(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const SETTINGS = [
    { key: "include_in_all", label: "Include in root domain listing", description: "Show this server's logs on the main chronicleclassic.com domain" },
    { key: "disable_client_upload", label: "Disable client uploads", description: "Only allow server-side log uploads" },
    { key: "discoverable", label: "Discoverable", description: "Appear on chronicleclassic.com for other players to find" },
  ] as const;

  const liveValues: Record<string, boolean> = {
    include_in_all: tenant.include_in_all,
    disable_client_upload: tenant.disable_client_upload,
    discoverable: tenant.discoverable,
  };

  const editValues: Record<string, boolean> = {
    include_in_all: includeInAll,
    disable_client_upload: disableClientUpload,
    discoverable: discoverable,
  };

  const setters: Record<string, (v: boolean) => void> = {
    include_in_all: setIncludeInAll,
    disable_client_upload: setDisableClientUpload,
    discoverable: setDiscoverable,
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Settings</h3>
        {req && <RequestBadge req={req} />}
      </div>

      {/* Live values */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium">Current (live)</p>
        {SETTINGS.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-56 shrink-0">{s.label}:</span>
            <span className={liveValues[s.key] ? "text-green-400" : "text-muted-foreground"}>{liveValues[s.key] ? "Yes" : "No"}</span>
          </div>
        ))}
      </div>

      {/* Pending request */}
      {req && req.status !== "approved" && !editing && (
        <div className="space-y-1 border-t pt-2">
          <p className="text-xs text-muted-foreground font-medium">Requested changes</p>
          {SETTINGS.map((s) => {
            const val = req.payload[s.key];
            return (
              <div key={s.key} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-56 shrink-0">{s.label}:</span>
                <span className={val === "true" || val === true ? "text-green-400" : "text-muted-foreground"}>
                  {val === "true" || val === true ? "Yes" : "No"}
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 pt-1">
            {req.status === "pending" && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
                setIncludeInAll(req.payload.include_in_all === "true" || req.payload.include_in_all === true);
                setDisableClientUpload(req.payload.disable_client_upload === "true" || req.payload.disable_client_upload === true);
                setDiscoverable(req.payload.discoverable === "true" || req.payload.discoverable === true);
                setEditing(true);
              }}>
                Edit
              </Button>
            )}
            {req.status === "rejected" && <DeleteRequestButton appId={appId} reqId={req.id} />}
            {canReview && <AdminReviewControls appId={appId} reqId={req.id} status={req.status} />}
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="space-y-2 border-t pt-2">
          <p className="text-xs text-muted-foreground font-medium">Edit settings</p>
          {SETTINGS.map((s) => (
            <label key={s.key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editValues[s.key]}
                onChange={(e) => setters[s.key](e.target.checked)}
                className="rounded border-border"
              />
              <div>
                <span className="text-sm">{s.label}</span>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </div>
            </label>
          ))}
          <div className="flex gap-2">
            <Button size="sm" className="text-xs h-7" disabled={createReq.isPending} onClick={handleSave}>
              {createReq.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {(!req || req.status === "approved") && !editing && (
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
          setIncludeInAll(tenant.include_in_all);
          setDisableClientUpload(tenant.disable_client_upload);
          setDiscoverable(tenant.discoverable);
          setEditing(true);
        }}>
          <Plus className="h-3 w-3 mr-1" /> Request settings change
        </Button>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Server / Realm cards
// ---------------------------------------------------------------------------

function SyncServersButton({ appId }: { appId: string }) {
  const sync = useSyncServers(appId);
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1 text-xs"
      disabled={sync.isPending}
      onClick={() =>
        sync.mutate(undefined, {
          onSuccess: () => toast.success("Servers synced"),
          onError: (err) => toast.error(err.message),
        })
      }
    >
      {sync.isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <RefreshCw className="h-3 w-3" />
      )}
      Sync Servers
    </Button>
  );
}

function AddServerForm({ appId }: { appId: string }) {
  const createReq = useCreateModificationRequest(appId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3 mr-1" /> Add Server
      </Button>
    );
  }

  const handleSubmit = () => {
    createReq.mutate(
      { type: "server", payload: { name, description, url: url || "" } },
      {
        onSuccess: () => {
          toast.success("Server request created");
          setOpen(false);
          setName("");
          setDescription("");
          setUrl("");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Card className="p-3 space-y-2">
      <p className="text-xs font-medium">New Server Request</p>
      <input className="w-full rounded-md border bg-background px-2 py-1 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="w-full rounded-md border bg-background px-2 py-1 text-sm" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input className="w-full rounded-md border bg-background px-2 py-1 text-sm" placeholder="URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" className="text-xs h-7" disabled={createReq.isPending || !name} onClick={handleSubmit}>
          {createReq.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit"}
        </Button>
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </Card>
  );
}

function AddRealmForm({ appId, parentId }: { appId: string; parentId: string }) {
  const createReq = useCreateModificationRequest(appId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3 mr-1" /> Add Realm
      </Button>
    );
  }

  const handleSubmit = () => {
    createReq.mutate(
      { type: "realm", parent_id: parentId, payload: { name, description, url: url || "" } },
      {
        onSuccess: () => {
          toast.success("Realm request created");
          setOpen(false);
          setName("");
          setDescription("");
          setUrl("");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <div className="ml-6 mt-2">
      <Card className="p-3 space-y-2">
        <p className="text-xs font-medium">New Realm Request</p>
        <input className="w-full rounded-md border bg-background px-2 py-1 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full rounded-md border bg-background px-2 py-1 text-sm" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input className="w-full rounded-md border bg-background px-2 py-1 text-sm" placeholder="URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <div className="flex gap-2">
          <Button size="sm" className="text-xs h-7" disabled={createReq.isPending || !name} onClick={handleSubmit}>
            {createReq.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit"}
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}

function EditableServerRealmFields({
  payload,
  onSave,
  isPending,
  label,
}: {
  payload: { name?: string; description?: string; url?: string };
  onSave: (p: { name: string; description: string; url?: string }) => void;
  isPending: boolean;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(payload.name ?? "");
  const [description, setDescription] = useState(payload.description ?? "");
  const [url, setUrl] = useState(payload.url ?? "");

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => { setName(payload.name ?? ""); setDescription(payload.description ?? ""); setUrl(payload.url ?? ""); setEditing(true); }}>
          <Pencil className="h-3 w-3 mr-1" /> Edit {label}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded border p-2">
      <p className="text-xs font-medium text-muted-foreground">Edit {label}</p>
      <input className="w-full rounded-md border bg-background px-2 py-1 text-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      <input className="w-full rounded-md border bg-background px-2 py-1 text-xs" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
      <input className="w-full rounded-md border bg-background px-2 py-1 text-xs" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (optional)" />
      <div className="flex gap-1">
        <Button size="sm" className="text-xs h-6" disabled={!name || isPending} onClick={() => { onSave({ name, description, url: url || undefined }); setEditing(false); }}>
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit Change"}
        </Button>
        <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function ServerRequestCard({
  appId,
  req,
  realmRequests,
  canReview,
}: {
  appId: string;
  req: ModificationRequest;
  realmRequests: ModificationRequest[];
  canReview: boolean;
}) {
  const createReq = useCreateModificationRequest(appId);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{req.payload.name || "Unnamed Server"}</h3>
        </div>
        <RequestBadge req={req} />
      </div>
      <div className="space-y-1 text-xs">
        {req.payload.description && (
          <div className="flex gap-2">
            <span className="text-muted-foreground w-24 shrink-0">Description:</span>
            <span>{req.payload.description}</span>
          </div>
        )}
        {req.payload.url && (
          <div className="flex gap-2">
            <span className="text-muted-foreground w-24 shrink-0">URL:</span>
            <span>{req.payload.url}</span>
          </div>
        )}
        {req.resource_id && (
          <div className="flex gap-2">
            <span className="text-muted-foreground w-24 shrink-0">Resource ID:</span>
            <span className="font-mono text-[11px]">{req.resource_id}</span>
          </div>
        )}
      </div>

      {/* Edit server (creates a new pending server request) */}
      {req.status === "approved" && (
        <EditableServerRealmFields
          payload={req.payload}
          label="server"
          isPending={createReq.isPending}
          onSave={(p) =>
            createReq.mutate(
              { type: "server", payload: { ...p, resource_id: req.resource_id } as never },
              {
                onSuccess: () => toast.success("Server change requested"),
                onError: (err) => toast.error(err.message),
              },
            )
          }
        />
      )}

      {/* Admin controls */}
      <div className="flex items-center gap-2">
        {req.status === "rejected" && <DeleteRequestButton appId={appId} reqId={req.id} />}
        {canReview && <AdminReviewControls appId={appId} reqId={req.id} status={req.status} />}
      </div>

      {/* Realm requests under this server */}
      {realmRequests.length > 0 && (
        <div className="border-t pt-2 space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Globe className="h-3 w-3" /> Realms
          </p>
          {realmRequests.map((realm) => (
            <div key={realm.id} className="ml-4 p-2 rounded border border-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{realm.payload.name || "Unnamed Realm"}</span>
                <RequestBadge req={realm} />
              </div>
              {realm.payload.description && (
                <p className="text-xs text-muted-foreground">{realm.payload.description}</p>
              )}
              {realm.payload.url && (
                <p className="text-xs text-muted-foreground">URL: {realm.payload.url}</p>
              )}
              {/* Edit realm (creates a new pending realm request) */}
              {realm.status === "approved" && (
                <EditableServerRealmFields
                  payload={realm.payload}
                  label="realm"
                  isPending={createReq.isPending}
                  onSave={(p) =>
                    createReq.mutate(
                      { type: "realm", parent_id: req.id, payload: { ...p, resource_id: realm.resource_id } as never },
                      {
                        onSuccess: () => toast.success("Realm change requested"),
                        onError: (err) => toast.error(err.message),
                      },
                    )
                  }
                />
              )}
              <div className="flex items-center gap-2">
                {realm.status === "rejected" && <DeleteRequestButton appId={appId} reqId={realm.id} />}
                {canReview && <AdminReviewControls appId={appId} reqId={realm.id} status={realm.status} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add realm request */}
      <AddRealmForm appId={appId} parentId={req.id} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Admins section
// ---------------------------------------------------------------------------

function AdminsSection({ appId }: { appId: string }) {
  const adminsQuery = useApplicationAdmins(appId);
  const addAdmin = useAddApplicationAdmin(appId);
  const removeAdmin = useRemoveApplicationAdmin(appId);
  const [userId, setUserId] = useState("");

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Application Admins</h3>
      </div>

      {adminsQuery.isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      )}

      {adminsQuery.data && adminsQuery.data.length > 0 && (
        <div className="space-y-1">
          {adminsQuery.data.map((a) => (
            <div key={a.user_id} className="flex items-center justify-between text-xs">
              <span>{a.username}{a.discord_id && <span className="text-muted-foreground ml-1">(Discord: {a.discord_id})</span>}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 text-red-400"
                disabled={removeAdmin.isPending}
                onClick={() =>
                  removeAdmin.mutate(a.user_id, {
                    onSuccess: () => toast.success("Admin removed"),
                    onError: (err) => toast.error(err.message),
                  })
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          className="rounded-md border bg-background px-2 py-1 text-xs flex-1"
          placeholder="User ID to add"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7"
          disabled={addAdmin.isPending || !userId.trim()}
          onClick={() =>
            addAdmin.mutate(userId.trim(), {
              onSuccess: () => {
                toast.success("Admin added");
                setUserId("");
              },
              onError: (err) => toast.error(err.message),
            })
          }
        >
          {addAdmin.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const appQuery = useServerApplication(id);

  if (!id) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <AlertCircle className="h-4 w-4" /> No application ID provided.
      </div>
    );
  }

  if (appQuery.isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (appQuery.isError || !appQuery.data) {
    return (
      <div className="flex items-center gap-2 p-8 text-red-400">
        <AlertCircle className="h-4 w-4" />
        {appQuery.error?.message ?? "Failed to load application."}
      </div>
    );
  }

  const app = appQuery.data;

  return <ApplicationPageContent app={app} />;
}

function ApplicationPageContent({ app }: { app: ServerApplication }) {
  const serverRequests = filterRequests(app.requests, "server");
  const realmRequests = filterRequests(app.requests, "realm");

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Beta notice */}
      <Card className="p-4 border-blue-500/30 bg-blue-500/5">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              You are applying to have your realm logs recognized by Chronicle.
              Many of the fields below relate to discoverability on{" "}
              <a href="https://chronicleclassic.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                chronicleclassic.com
              </a>.
            </p>
            <p className="text-xs text-muted-foreground/70">
              This feature is in beta — please be patient and report any bugs or feedback.
            </p>
          </div>
        </div>
      </Card>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">{app.name}</h1>
        <p className="text-sm text-muted-foreground">
          Application by <span className="font-medium text-foreground">{app.username}</span>
          {" · "}Created {new Date(app.created_at).toLocaleDateString()}
        </p>
        {app.can_review && (
          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs font-medium rounded bg-blue-500/15 text-blue-400">
            <Users className="h-3 w-3" /> Admin reviewer
          </span>
        )}
      </div>

      {/* Branding sections */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Branding
        </h2>
        {BRANDING_SECTIONS.map((section) => (
          <BrandingSectionCard
            key={section.type}
            section={section}
            appId={app.id}
            requests={app.requests}
            tenant={app.tenant}
            canReview={app.can_review}
          />
        ))}
        <ThemeSectionCard
          appId={app.id}
          requests={app.requests}
          tenant={app.tenant}
          canReview={app.can_review}
        />
      </div>

      <SettingsSectionCard
        appId={app.id}
        requests={app.requests}
        tenant={app.tenant}
        canReview={app.can_review}
      />

      {/* Servers & Realms */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Servers & Realms
          </h2>
          <SyncServersButton appId={app.id} />
        </div>
        <p className="text-xs text-muted-foreground">
          Match your <code className="bg-muted px-1 py-0.5 rounded">realmlist.wtf</code>.
          A <strong>server</strong> is an auth server and a <strong>realm</strong> is a playable realm.
          Match the name of the realm <strong>exactly</strong> as it appears in-game — this is string-matched in the combat logs.
        </p>
        {serverRequests.map((srv) => (
          <ServerRequestCard
            key={srv.id}
            appId={app.id}
            req={srv}
            realmRequests={realmRequests.filter((r) => r.parent_id === srv.id)}
            canReview={app.can_review}
          />
        ))}
        <AddServerForm appId={app.id} />
      </div>

      {/* Admins */}
      {app.can_review && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Admin Management
          </h2>
          <AdminsSection appId={app.id} />
        </div>
      )}
    </div>
  );
}
