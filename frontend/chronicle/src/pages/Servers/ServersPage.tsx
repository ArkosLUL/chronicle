import { useState } from "react";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";
import {
  useAzerothcoreServers,
  useCreateAzerothcoreServer,
  useDeleteAzerothcoreServer,
  useAzerothcoreRealms,
  useCreateAzerothcoreRealm,
  useDeleteAzerothcoreRealm,
} from "@/api/queries";
import { Loader2, Trash2, Plus, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import type { WoWServer } from "@/api/typesGenerated";

function RealmsList({ server }: { server: WoWServer }) {
  const { data: realms, isLoading } = useAzerothcoreRealms(server.id);
  const createRealm = useCreateAzerothcoreRealm();
  const deleteRealm = useDeleteAzerothcoreRealm();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createRealm.mutate(
      { serverId: server.id, name, description, url: url || undefined },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
          setUrl("");
          setShowAdd(false);
        },
      },
    );
  };

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-2">
      {realms?.map((realm) => (
        <div key={realm.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <div>
            <span className="font-medium">{realm.name}</span>
            {realm.description && <span className="text-muted-foreground ml-2">— {realm.description}</span>}
            {realm.url && (
              <a href={realm.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-blue-500 hover:underline">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => {
              if (window.confirm(`Delete realm "${realm.name}"?`)) {
                deleteRealm.mutate(realm.id);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      {showAdd ? (
        <form onSubmit={handleCreate} className="space-y-2 rounded-md border p-3">
          <input
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            placeholder="Realm name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            placeholder="URL (optional)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createRealm.isPending}>
              {createRealm.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
          {createRealm.isError && <p className="text-sm text-destructive">{createRealm.error.message}</p>}
        </form>
      ) : (
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Realm
        </Button>
      )}
    </div>
  );
}

function ServerCard({ server }: { server: WoWServer }) {
  const deleteServer = useDeleteAzerothcoreServer();
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-base">{server.name}</h3>
          {server.description && <p className="text-sm text-muted-foreground">{server.description}</p>}
          {server.url && (
            <a href={server.url} target="_blank" rel="noreferrer" className="text-sm text-blue-500 hover:underline inline-flex items-center gap-1">
              {server.url} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() => {
            if (window.confirm(`Delete server "${server.name}" and all its realms?`)) {
              deleteServer.mutate(server.id);
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <button
        type="button"
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Realms
      </button>

      {expanded && <RealmsList server={server} />}
    </Card>
  );
}

export function ServersPage() {
  const { data: servers, isLoading } = useAzerothcoreServers();
  const createServer = useCreateAzerothcoreServer();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createServer.mutate(
      { name, description, url: url || undefined },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
          setUrl("");
          setShowAdd(false);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Servers & Realms</h2>
        <Button size="sm" className="gap-1" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4" /> Add Server
        </Button>
      </div>

      {showAdd && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="space-y-2">
            <input
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              placeholder="Server name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <input
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              placeholder="URL (optional)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={createServer.isPending}>
                {createServer.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create Server"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
            {createServer.isError && <p className="text-sm text-destructive">{createServer.error.message}</p>}
          </form>
        </Card>
      )}

      {servers?.length === 0 && (
        <p className="text-muted-foreground text-sm">No servers yet. Create one to get started.</p>
      )}

      {servers?.map((server) => (
        <ServerCard key={server.id} server={server} />
      ))}
    </div>
  );
}
