import { Hero } from "./components/Hero";
import { ServerGrid } from "./components/ServerGrid";
import { Footer } from "./components/Footer";
import { SERVERS } from "./data/servers";

export function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Hero />
      <main className="flex-1">
        <ServerGrid servers={SERVERS} />
      </main>
      <Footer />
    </div>
  );
}
