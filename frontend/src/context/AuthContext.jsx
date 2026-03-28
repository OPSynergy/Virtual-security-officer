import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isDemoMode, setDemoMode] = useState(localStorage.getItem("vsoDemoMode") === "true");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthReady(true);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
      setUser(data.session?.user || null);
      if (data.session?.access_token) {
        localStorage.setItem("vsoToken", `Bearer ${data.session.access_token}`);
      }
      setAuthReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setUser(nextSession?.user || null);
      if (nextSession?.access_token) {
        localStorage.setItem("vsoToken", `Bearer ${nextSession.access_token}`);
      } else {
        localStorage.removeItem("vsoToken");
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("vsoDemoMode", String(isDemoMode));
  }, [isDemoMode]);

  async function signOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    localStorage.removeItem("vsoToken");
  }

  const value = useMemo(
    () => ({ user, session, signOut, isDemoMode, setDemoMode, authReady }),
    [user, session, isDemoMode, authReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("Virtual Security Officer AuthContext is not available.");
  }
  return ctx;
}
