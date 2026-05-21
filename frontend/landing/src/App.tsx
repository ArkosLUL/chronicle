import { ServerGrid } from "./components/ServerGrid";
import { Footer } from "./components/Footer";
import { useDiscovery } from "./hooks/useDiscovery";
import { SERVERS, DISCOVERY_URLS } from "./data/servers";

export function App() {
  const { servers, loading } = useDiscovery(SERVERS, DISCOVERY_URLS);

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1">
        <ServerGrid servers={servers} loading={loading} />
      </main>
      <Footer />
    </div>
  );
}
