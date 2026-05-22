import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  useServerApplication,
  useUpdateServerApplication,
  useReviewApplicationField,
  useApproveApplication,
  useRejectApplication,
  useApproveServer,
  useRejectServer,
  useApproveRealm,
  useRejectRealm,
  useAddApplicationServer,
  useAddApplicationRealm,
} from "@/api/queries";
import type {
  ServerApplication,
  ServerApplicationServer,
  ServerApplicationRealm,
  FieldReview,
} from "@/api/typesGenerated";
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
  Plus,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";

// --- Status helpers ---

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

function FieldReviewBadge({ review }: { review: FieldReview | undefined }) {
  if (!review) return null;
  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={review.status} />
      {review.note && <span className="text-xs text-muted-foreground italic">"{review.note}"</span>}
    </div>
  );
}

// --- Admin review controls ---

function AdminReviewButtons({
  section,
  appId,
  currentStatus,
}: {
  section: string;
  appId: string;
  currentStatus: string;
}) {
  const reviewField = useReviewApplicationField(appId);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  const handleReview = (status: "approved" | "rejected") => {
    reviewField.mutate(
      { section, status, note: note || null },
      {
        onSuccess: () => {
          toast.success(`Section ${status}`);
          setNote("");
          setShowNote(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showNote && (
        <div className="flex items-center gap-2">
          <input
            className="rounded-md border bg-background px-2 py-1 text-xs w-48"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Review note (optional)"
          />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNote(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      {!showNote && (
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowNote(true)}>
          Add note
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="text-xs h-7 text-green-400 border-green-400/30"
        disabled={reviewField.isPending || currentStatus === "approved"}
        onClick={() => handleReview("approved")}
      >
        {reviewField.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-xs h-7 text-red-400 border-red-400/30"
        disabled={reviewField.isPending || currentStatus === "rejected"}
        onClick={() => handleReview("rejected")}
      >
        {reviewField.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reject"}
      </Button>
    </div>
  );
}

function ServerReviewButtons({
  appId,
  serverReqId,
  status,
}: {
  appId: string;
  serverReqId: string;
  status: string;
}) {
  const approve = useApproveServer(appId, serverReqId);
  const reject = useRejectServer(appId, serverReqId);
  const [note, setNote] = useState("");

  return (
    <div className="flex items-center gap-2">
      <input
        className="rounded-md border bg-background px-2 py-1 text-xs w-32"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
      />
      <Button
        variant="outline"
        size="sm"
        className="text-xs h-7 text-green-400 border-green-400/30"
        disabled={approve.isPending || status === "approved"}
        onClick={() =>
          approve.mutate(undefined, {
            onSuccess: () => toast.success("Server approved"),
            onError: (err) => toast.error(err.message),
          })
        }
      >
        Approve
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-xs h-7 text-red-400 border-red-400/30"
        disabled={reject.isPending || status === "rejected"}
        onClick={() =>
          reject.mutate(
            { admin_note: note || undefined },
            {
              onSuccess: () => toast.success("Server rejected"),
              onError: (err) => toast.error(err.message),
            },
          )
        }
      >
        Reject
      </Button>
    </div>
  );
}

function RealmReviewButtons({
  appId,
  serverReqId,
  realmReqId,
  status,
}: {
  appId: string;
  serverReqId: string;
  realmReqId: string;
  status: string;
}) {
  const approve = useApproveRealm(appId, serverReqId, realmReqId);
  const reject = useRejectRealm(appId, serverReqId, realmReqId);
  const [note, setNote] = useState("");

  return (
    <div className="flex items-center gap-2">
      <input
        className="rounded-md border bg-background px-2 py-1 text-xs w-32"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
      />
      <Button
        variant="outline"
        size="sm"
        className="text-xs h-7 text-green-400 border-green-400/30"
        disabled={approve.isPending || status === "approved"}
        onClick={() =>
          approve.mutate(undefined, {
            onSuccess: () => toast.success("Realm approved"),
            onError: (err) => toast.error(err.message),
          })
        }
      >
        Approve
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-xs h-7 text-red-400 border-red-400/30"
        disabled={reject.isPending || status === "rejected"}
        onClick={() =>
          reject.mutate(
            { admin_note: note || undefined },
            {
              onSuccess: () => toast.success("Realm rejected"),
              onError: (err) => toast.error(err.message),
            },
          )
        }
      >
        Reject
      </Button>
    </div>
  );
}

// --- Applicant edit controls ---

function EditableField({
  value,
  canEdit,
  onSave,
}: {
  value: string;
  canEdit: boolean;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">{value || <span className="text-muted-foreground italic">Not set</span>}</span>
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="rounded-md border bg-background px-2 py-1 text-sm flex-1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <Button
        variant="outline"
        size="sm"
        className="text-xs h-7"
        onClick={() => {
          onSave(draft);
          setEditing(false);
        }}
      >
        Save
      </Button>
      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  );
}

// --- Add server/realm forms ---

function AddServerForm({ appId }: { appId: string }) {
  const addServer = useAddApplicationServer(appId);
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [realmName, setRealmName] = useState("");
  const [realmDesc, setRealmDesc] = useState("");

  if (!show) {
    return (
      <Button variant="outline" size="sm" className="gap-1" onClick={() => setShow(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add Server
      </Button>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addServer.mutate(
      {
        name,
        description,
        url: url || null,
        realms: realmName ? [{ name: realmName, description: realmDesc, url: null }] : [],
      },
      {
        onSuccess: () => {
          toast.success("Server added");
          setShow(false);
          setName("");
          setDescription("");
          setUrl("");
          setRealmName("");
          setRealmDesc("");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-md border p-3">
      <input className="w-full rounded-md border bg-background px-3 py-1.5 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Server name" required />
      <input className="w-full rounded-md border bg-background px-3 py-1.5 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
      <input className="w-full rounded-md border bg-background px-3 py-1.5 text-sm" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (optional)" />
      <div className="border-t pt-2 space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Initial Realm (optional)</span>
        <input className="w-full rounded-md border bg-background px-3 py-1.5 text-sm" value={realmName} onChange={(e) => setRealmName(e.target.value)} placeholder="Realm name" />
        <input className="w-full rounded-md border bg-background px-3 py-1.5 text-sm" value={realmDesc} onChange={(e) => setRealmDesc(e.target.value)} placeholder="Realm description" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={addServer.isPending} className="gap-1">
          {addServer.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShow(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AddRealmForm({ appId, serverReqId }: { appId: string; serverReqId: string }) {
  const addRealm = useAddApplicationRealm(appId, serverReqId);
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  if (!show) {
    return (
      <Button variant="outline" size="sm" className="gap-1" onClick={() => setShow(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add Realm
      </Button>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addRealm.mutate(
      { name, description, url: url || null },
      {
        onSuccess: () => {
          toast.success("Realm added");
          setShow(false);
          setName("");
          setDescription("");
          setUrl("");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-md border p-3">
      <input className="w-full rounded-md border bg-background px-3 py-1.5 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Realm name" required />
      <input className="w-full rounded-md border bg-background px-3 py-1.5 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
      <input className="w-full rounded-md border bg-background px-3 py-1.5 text-sm" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (optional)" />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={addRealm.isPending} className="gap-1">
          {addRealm.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShow(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// --- Section cards ---

const FIELD_SECTIONS = [
  { key: "name", label: "Name" },
  { key: "display_name", label: "Display Name" },
  { key: "tagline", label: "Tagline" },
  { key: "slug", label: "Slug" },
  { key: "description", label: "Description" },
] as const;

function TenantFieldsSection({
  app,
  canEdit,
}: {
  app: ServerApplication;
  canEdit: boolean;
}) {
  const updateApp = useUpdateServerApplication(app.id);

  const handleSave = (field: string, value: string) => {
    const req: Record<string, unknown> = {
      name: null,
      display_name: null,
      tagline: null,
      description: null,
      tags: app.tenant.branding?.tags ?? [],
      slug: null,
      branding: null,
    };
    req[field] = value;
    updateApp.mutate(req as never, {
      onSuccess: () => toast.success("Updated"),
      onError: (err) => toast.error(err.message),
    });
  };

  const branding = app.tenant.branding;
  const fieldValues: Record<string, string> = {
    name: app.name,
    display_name: branding?.display_name ?? "",
    tagline: branding?.tagline ?? "",
    slug: app.tenant.slug ?? "",
    description: branding?.description ?? "",
  };

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Tenant Details</h2>
      <div className="space-y-3">
        {FIELD_SECTIONS.map(({ key, label }) => {
          const review = app.field_reviews[key];
          const sectionEditable = canEdit && (!review || review.status !== "approved");
          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-28">{label}</span>
                <FieldReviewBadge review={review} />
              </div>
              <EditableField
                value={fieldValues[key] ?? ""}
                canEdit={sectionEditable}
                onSave={(v) => handleSave(key, v)}
              />
              {app.can_review && (
                <AdminReviewButtons section={key} appId={app.id} currentStatus={review?.status ?? "pending"} />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function RealmCard({
  realm,
  appId,
  serverReqId,
  canReview,
}: {
  realm: ServerApplicationRealm;
  appId: string;
  serverReqId: string;
  canReview: boolean;
}) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{realm.name}</span>
          <StatusBadge status={realm.status} />
        </div>
      </div>
      {realm.description && <p className="text-xs text-muted-foreground">{realm.description}</p>}
      {realm.url && (
        <a href={realm.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
          {realm.url}
        </a>
      )}
      {realm.admin_note && <p className="text-xs text-muted-foreground italic">Note: {realm.admin_note}</p>}
      {canReview && (
        <RealmReviewButtons appId={appId} serverReqId={serverReqId} realmReqId={realm.id} status={realm.status} />
      )}
    </div>
  );
}

function ServerCard({
  server,
  appId,
  canReview,
  canEdit,
}: {
  server: ServerApplicationServer;
  appId: string;
  canReview: boolean;
  canEdit: boolean;
}) {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4" />
          <h3 className="text-base font-semibold">{server.name}</h3>
          <StatusBadge status={server.status} />
        </div>
        {canReview && <ServerReviewButtons appId={appId} serverReqId={server.id} status={server.status} />}
      </div>
      {server.description && <p className="text-sm text-muted-foreground">{server.description}</p>}
      {server.url && (
        <a href={server.url} target="_blank" rel="noreferrer" className="text-sm text-blue-500 hover:underline">
          {server.url}
        </a>
      )}
      {server.admin_note && <p className="text-xs text-muted-foreground italic">Note: {server.admin_note}</p>}

      <div className="border-t pt-4 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Globe className="h-3.5 w-3.5" />
          Realms
        </h4>
        {server.realms.map((realm) => (
          <RealmCard key={realm.id} realm={realm} appId={appId} serverReqId={server.id} canReview={canReview} />
        ))}
        {canEdit && <AddRealmForm appId={appId} serverReqId={server.id} />}
      </div>
    </Card>
  );
}

// --- Application-level admin actions ---

function ApplicationActions({ app }: { app: ServerApplication }) {
  const approveApp = useApproveApplication(app.id);
  const rejectApp = useRejectApplication(app.id);
  const [rejectNote, setRejectNote] = useState("");

  return (
    <Card className="p-6 space-y-4 border-dashed border-2">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        Admin Actions
      </h2>
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          className="gap-2 bg-green-600 hover:bg-green-700"
          disabled={approveApp.isPending || app.status === "approved"}
          onClick={() =>
            approveApp.mutate(undefined, {
              onSuccess: () => toast.success("Application approved!"),
              onError: (err) => toast.error(err.message),
            })
          }
        >
          {approveApp.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          <CheckCircle2 className="h-4 w-4" />
          Approve Application
        </Button>
        <div className="flex items-center gap-2">
          <input
            className="rounded-md border bg-background px-3 py-1.5 text-sm w-48"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Rejection reason (optional)"
          />
          <Button
            variant="destructive"
            className="gap-2"
            disabled={rejectApp.isPending || app.status === "rejected"}
            onClick={() =>
              rejectApp.mutate(
                { admin_note: rejectNote || undefined },
                {
                  onSuccess: () => toast.success("Application rejected"),
                  onError: (err) => toast.error(err.message),
                },
              )
            }
          >
            {rejectApp.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <XCircle className="h-4 w-4" />
            Reject Application
          </Button>
        </div>
      </div>
    </Card>
  );
}

// --- Main page ---

export function ApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const { data: app, isLoading, error } = useServerApplication(id);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading application...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <h2 className="font-semibold text-lg">Application Not Found</h2>
              <p className="text-muted-foreground mt-1">
                {error?.message ?? "This application could not be loaded."}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const canEdit = app.status !== "approved";

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{app.name}</h1>
          <p className="text-sm text-muted-foreground">
            Applied by {app.username} on{" "}
            {new Date(app.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      {/* Status banner */}
      {app.status === "rejected" && app.admin_note && (
        <div className="rounded-md border border-red-400/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">
            <strong>Rejected:</strong> {app.admin_note}
          </p>
        </div>
      )}
      {app.status === "approved" && (
        <div className="rounded-md border border-green-400/30 bg-green-500/10 p-4">
          <p className="text-sm text-green-400">
            This application has been approved. Your tenant is being set up.
          </p>
        </div>
      )}

      {/* Admin actions */}
      {app.can_review && <ApplicationActions app={app} />}

      {/* Tenant fields */}
      <TenantFieldsSection app={app} canEdit={canEdit} />

      {/* Servers */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Servers & Realms</h2>
        {app.servers.map((server) => (
          <ServerCard key={server.id} server={server} appId={app.id} canReview={app.can_review} canEdit={canEdit} />
        ))}
        {canEdit && <AddServerForm appId={app.id} />}
      </div>
    </div>
  );
}
