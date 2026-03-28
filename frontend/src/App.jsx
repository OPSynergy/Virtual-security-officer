import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import splashLogo from "./assets/vso_sq.png";
import DashboardLayout from "./pages/DashboardLayout";
import Home from "./pages/Home";
import History from "./pages/History";
import Alerts from "./pages/Alerts";
import AiChat from "./pages/AiChat";
import Login from "./pages/Login";

function ProtectedRoute({ children }) {
  const { session, isDemoMode, authReady } = useAuth();
  if (!authReady) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8 text-center text-zinc-400">
        Loading Virtual Security Officer...
      </div>
    );
  }
  if (!session && !isDemoMode) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <div className="fixed inset-0 z-50 flex animate-fade-in flex-col items-center justify-center bg-zinc-950 px-6">
        <div className="flex max-w-lg flex-col items-center text-center">
          <img
            src={splashLogo}
            alt=""
            width={320}
            height={320}
            className="animate-logo-flicker h-64 w-64 max-h-[min(55vh,360px)] max-w-[min(85vw,360px)] object-contain sm:h-72 sm:w-72"
            draggable={false}
          />
          <h1 className="mt-6 text-xl font-bold tracking-[0.2em] text-white sm:text-2xl">VIRTUAL SECURITY OFFICER</h1>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="history" element={<History />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="chat" element={<AiChat />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
