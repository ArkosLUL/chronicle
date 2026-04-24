import { useState } from "react";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";
import {
  useAzerothcoreServers,
  useAzerothcoreRealms,
  useAzerothcoreUploadKeys,
  useCreateAzerothcoreUploadKey,
  useDeleteAzerothcoreUploadKey,
} from "@/api/queries";
import { Loader2, Trash2, Plus, Copy, Check } from "lucide-react";
import type { UploadKey } from "@/api/typesGenerated";

function KeyRow({ uploadKey }: { uploadKey: UploadKey }) {
  const deleteKey = useDeleteAzerothcoreUploadKey();

  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
      <div className="space-y-0.5">
        <div className="font-medium">{uploadKey.description || "Unnamed key"}</div>
        <div className="text-xs text-muted-foreground">
          Created: {new Date(uploadKey.created_at).toLocaleDateString()}
          {uploadKey.last_used_at && <> · Last used: {new Date(uploadKey.last_used_at).toLocaleDateString()}</>}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive"
        onClick={() => {
          if (window.confirm("Delete this upload key? This cannot be undone.")) {
            deleteKey.mutate(uploadKey.id);
          }
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function CopyableSecret({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 space-y-2">
      <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
        ⚠️ Copy this key now — it won't be shown again!
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded bg-muted px-2 py-1 text-xs font-mono break-all">{secret}</code>
        <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function UploadKeysPage() {
  const { data: servers, isLoading: serversLoading } = useAzerothcoreServers();
  const [selectedServerId, setSelectedServerId] = useState("");
  const [selectedRealmId, setSelectedRealmId] = useState("");
  const [description, setDescription] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const { data: realms, isLoading: realmsLoading } = useAzerothcoreRealms(selectedServerId);
  const { data: keys, isLoading: keysLoading } = useAzerothcoreUploadKeys(selectedRealmId);
  const createKey = useCreateAzerothcoreUploadKey();

  const handleServerChange = (serverId: string) => {
    setSelectedServerId(serverId);
    setSelectedRealmId("");
    setNewSecret(null);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createKey.mutate(
      { realmId: selectedRealmId, description },
      {
        onSuccess: (data) => {
          setDescription("");
          if (data.secret) {
            setNewSecret(data.secret);
          }
        },
      },
    );
  };

  if (serversLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Upload Keys</h2>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          value={selectedServerId}
          onChange={(e) => handleServerChange(e.target.value)}
        >
          <option value="">Select a server…</option>
          {servers?.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          value={selectedRealmId}
          onChange={(e) => { setSelectedRealmId(e.target.value); setNewSecret(null); }}
          disabled={!selectedServerId || realmsLoading}
        >
          <option value="">Select a realm…</option>
          {realms?.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {selectedRealmId && (
        <div className="space-y-3">
          {newSecret && <CopyableSecret secret={newSecret} />}

          <Card className="p-4">
            <form onSubmit={handleCreate} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">New Upload Key</label>
                <input
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm mt-1"
                  placeholder="Key description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" size="sm" className="gap-1" disabled={createKey.isPending}>
                {createKey.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create
              </Button>
            </form>
            {createKey.isError && <p className="text-sm text-destructive mt-2">{createKey.error.message}</p>}
          </Card>

          {keysLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : keys?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upload keys for this realm yet.</p>
          ) : (
            <div className="space-y-2">
              {keys?.map((key) => (
                <KeyRow key={key.id} uploadKey={key} />
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedRealmId && selectedServerId && !realmsLoading && realms?.length === 0 && (
        <p className="text-sm text-muted-foreground">This server has no realms. Add one in Servers & Realms first.</p>
      )}
    </div>
  );
}
