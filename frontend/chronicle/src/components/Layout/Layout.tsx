import { Outlet } from "react-router-dom";
import { NavBar } from "../NavBar/NavBar";
import { Footer } from "../Footer/Footer";
import { Toaster } from "../ui/Sonner/Sonner";
import { TooltipProvider } from "../ui/Tooltip/tooltip";
import { FarewellBanner } from "../FarewellBanner/FarewellBanner";
import { usePageTracking } from "@/hooks/usePageTracking";

export function Layout() {
  usePageTracking();

  return (
    <TooltipProvider>
      <FarewellBanner />
      <NavBar />
      <main>
        <Outlet />
      </main>
      <Footer />
      <Toaster />
    </TooltipProvider>
  );
}
