import { Outlet } from "react-router-dom";

import DemoBanner from "../components/DemoBanner";
import Sidebar from "../components/Sidebar";
import { DashboardProvider, useDashboard } from "../context/DashboardContext";

function DemoBannerHost() {
  const { isDemoMode, showDemoBanner, setShowDemoBanner } = useDashboard();
  if (!isDemoMode || !showDemoBanner) return null;
  return <DemoBanner onDismiss={() => setShowDemoBanner(false)} />;
}

function DashboardShell() {
  return (
    <div className="flex h-full min-h-0 w-full flex-1">
      <Sidebar />
      <main className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-zinc-950 p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(34,211,238,0.07),transparent)]" />
        <div className="relative">
          <DemoBannerHost />
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-zinc-950 text-zinc-100">
      <DashboardProvider>
        <DashboardShell />
      </DashboardProvider>
    </div>
  );
}
