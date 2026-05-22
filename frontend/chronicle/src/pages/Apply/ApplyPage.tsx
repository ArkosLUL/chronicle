import { useState, useMemo } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAuthorizationCheck, useMyServerApplications, useCreateServerApplication } from "@/api/queries";
import type { CreateServerApplicationRequest, CreateServerRequest, CreateRealmRequest, ServerApplication } from "@/api/typesGenerated";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn, CheckCircle2, XCircle, Plus, Trash2, Server, Globe, Info } from "lucide-react";
import { toast } from "sonner";

function RequirementsChecklist() {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Apply to Host a Server</h2>
        <p className="text-muted-foreground mb-6">
          Before you can submit an application, please complete the following:
        </p>
        <ul className="space-y-3">
          <li className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span>Sign in to Chronicle</span>
          </li>
          <li className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <span>Join the Chronicle Discord server</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

interface ServerFormData {
  name: string;
  description: string;
  url: string;
  realms: { name: string; description: string; url: string }[];
}

function CreateApplicationForm() {
  const navigate = useNavigate();
  const createApp = useCreateServerApplication();

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");
  const [servers, setServers] = useState<ServerFormData[]>([
    { name: "", description: "", url: "", realms: [{ name: "", description: "", url: "" }] },
  ]);

  const updateServer = (idx: number, field: keyof Omit<ServerFormData, "realms">, value: string) => {
    setServers((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const addServer = () => {
    setServers((prev) => [...prev, { name: "", description: "", url: "", realms: [{ name: "", description: "", url: "" }] }]);
  };

  const removeServer = (idx: number) => {
    setServers((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRealm = (sIdx: number, rIdx: number, field: string, value: string) => {
    setServers((prev) =>
      prev.map((s, si) =>
        si === sIdx
          ? { ...s, realms: s.realms.map((r, ri) => (ri === rIdx ? { ...r, [field]: value } : r)) }
          : s,
      ),
    );
  };

  const addRealm = (sIdx: number) => {
    setServers((prev) =>
      prev.map((s, si) => (si === sIdx ? { ...s, realms: [...s.realms, { name: "", description: "", url: "" }] } : s)),
    );
  };

  const removeRealm = (sIdx: number, rIdx: number) => {
    setServers((prev) =>
      prev.map((s, si) => (si === sIdx ? { ...s, realms: s.realms.filter((_, ri) => ri !== rIdx) } : s)),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const serverRequests: CreateServerRequest[] = servers.map((s) => ({
      name: s.name,
      description: s.description,
      url: s.url || null,
      realms: s.realms.map(
        (r): CreateRealmRequest => ({
          name: r.name,
          description: r.description,
          url: r.url || null,
        }),
      ),
    }));

    const request: CreateServerApplicationRequest = {
      name,
      display_name: displayName,
      tagline,
      tags: [],
      servers: serverRequests,
    };

    createApp.mutate(request, {
      onSuccess: (app) => {
        toast.success("Application submitted!");
        navigate(`/apply/${app.id}`);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Apply to Host a Server</h1>

      <Card className="p-4 mb-6 border-blue-500/30 bg-blue-500/5">
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Tenant Details</h2>
          <p className="text-sm text-muted-foreground">
            A universal name for you or your team is required. This identifies your group to other players.
            If you only have one server, this name is likely to be the same as the server name.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Name (unique identifier)</label>
              <input
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-server"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Display Name</label>
              <input
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="My Awesome Server"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tagline</label>
              <input
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="A brief description of your server"
              />
            </div>

          </div>
        </Card>

        <Card className="p-4 border-muted bg-muted/30">
          <div className="flex gap-3">
            <Server className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Match your <code className="text-xs bg-muted px-1 py-0.5 rounded">realmlist.wtf</code>.
              A <strong>server</strong> is an auth server and a <strong>realm</strong> is a playable realm.
              Match the name of the realm <strong>exactly</strong> as it appears in-game — this is string-matched in the combat logs.
            </p>
          </div>
        </Card>

        {servers.map((server, sIdx) => (
          <Card key={sIdx} className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Server className="h-4 w-4" />
                Server {sIdx + 1}
              </h2>
              {servers.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeServer(sIdx)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Server Name</label>
                <input
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                  value={server.name}
                  onChange={(e) => updateServer(sIdx, "name", e.target.value)}
                  placeholder="Server name"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Server Description</label>
                <input
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                  value={server.description}
                  onChange={(e) => updateServer(sIdx, "description", e.target.value)}
                  placeholder="What makes this server unique?"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Server URL (optional)</label>
                <input
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                  value={server.url}
                  onChange={(e) => updateServer(sIdx, "url", e.target.value)}
                  placeholder="https://myserver.com"
                />
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-3.5 w-3.5" />
                Realms
              </h3>
              {server.realms.map((realm, rIdx) => (
                <div key={rIdx} className="flex items-start gap-2 rounded-md border p-3">
                  <div className="flex-1 space-y-2">
                    <input
                      className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                      value={realm.name}
                      onChange={(e) => updateRealm(sIdx, rIdx, "name", e.target.value)}
                      placeholder="Realm name"
                      required
                    />
                    <input
                      className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                      value={realm.description}
                      onChange={(e) => updateRealm(sIdx, rIdx, "description", e.target.value)}
                      placeholder="Realm description"
                    />
                    <input
                      className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                      value={realm.url}
                      onChange={(e) => updateRealm(sIdx, rIdx, "url", e.target.value)}
                      placeholder="Realm URL (optional)"
                    />
                  </div>
                  {server.realms.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRealm(sIdx, rIdx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => addRealm(sIdx)}>
                <Plus className="h-3.5 w-3.5" />
                Add Realm
              </Button>
            </div>
          </Card>
        ))}

        <Button type="button" variant="outline" className="gap-2" onClick={addServer}>
          <Plus className="h-4 w-4" />
          Add Another Server
        </Button>

        <div className="flex justify-end">
          <Button type="submit" disabled={createApp.isPending} className="gap-2">
            {createApp.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Application
          </Button>
        </div>
      </form>
    </div>
  );
}

function ApplicationSelector({ apps }: { apps: ServerApplication[] }) {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Your Applications</h2>
        <p className="text-sm text-muted-foreground">
          You have access to multiple server applications. Select one to view.
        </p>
        <div className="space-y-2">
          {apps.map((app) => (
            <Link
              key={app.id}
              to={`/apply/${app.id}`}
              className="flex items-center justify-between rounded-md border px-4 py-3 hover:bg-accent transition-colors"
            >
              <div>
                <p className="font-medium">{app.name}</p>
                <p className="text-xs text-muted-foreground">
                  {app.tenant?.branding?.display_name || app.name}
                  {app.requests && ` · ${app.requests.filter((r) => r.status === "pending").length} pending`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ApplyPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const authzChecks = useMemo(() => ({ canApply: "chronicle:chronicle#create_tenant_application" }), []);
  const { data: authz, isLoading: authzLoading } = useAuthorizationCheck(authzChecks, {
    enabled: isAuthenticated,
  });
  const { data: existingApps, isLoading: appLoading } = useMyServerApplications();

  const isLoading = authLoading || (isAuthenticated && (authzLoading || appLoading));

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <LogIn className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="font-semibold text-lg">Sign In Required</h2>
              <p className="text-muted-foreground mt-1">
                You need to sign in to apply for hosting a server on Chronicle.
              </p>
            </div>
            <Link to="/login">
              <Button className="gap-2">
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!authz?.canApply) {
    return <RequirementsChecklist />;
  }

  if (existingApps && existingApps.length === 1) {
    return <Navigate to={`/apply/${existingApps[0].id}`} replace />;
  }

  if (existingApps && existingApps.length > 1) {
    return <ApplicationSelector apps={existingApps} />;
  }

  return <CreateApplicationForm />;
}
