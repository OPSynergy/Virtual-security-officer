import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import vsoLogo from "../assets/vso.png";

function Login() {
  const navigate = useNavigate();
  const { setDemoMode } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e) {
    e.preventDefault();
    if (!isSupabaseConfigured || !supabase) {
      setError(
        "Virtual Security Officer sign-in is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend environment settings."
      );
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message || "Virtual Security Officer sign-in failed.");
      setLoading(false);
      return;
    }
    if (data.session?.access_token) {
      localStorage.setItem("vsoToken", `Bearer ${data.session.access_token}`);
    }
    setDemoMode(false);
    setLoading(false);
    navigate("/");
  }

  async function handleCreateAccount() {
    if (!isSupabaseConfigured || !supabase) {
      setError(
        "Virtual Security Officer sign-up is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend environment settings."
      );
      return;
    }
    setLoading(true);
    setError("");
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message || "Virtual Security Officer account creation failed.");
      setLoading(false);
      return;
    }
    setLoading(false);
  }

  return (
    <div className="relative min-h-screen bg-zinc-950">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(34,211,238,0.07),transparent)]"
        aria-hidden
      />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-5 py-16">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 text-center">
            <img
              src={vsoLogo}
              alt="Virtual Security Officer"
              className="mx-auto h-auto w-full max-w-[min(280px,85vw)] object-contain select-none"
              draggable={false}
            />
            <p className="mt-6 text-[13px] leading-relaxed text-zinc-500">Sign in to continue</p>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/20 p-8 shadow-sm shadow-black/20">
            <form onSubmit={handleSignIn} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-[13px] font-medium text-zinc-400">
                  Email
                </label>
                <input
                  id="login-email"
                  className="h-11 w-full rounded-xl border-0 bg-zinc-950/80 px-3.5 text-[15px] text-zinc-100 outline-none ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:ring-2 focus:ring-cyan-500/35"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="login-password" className="text-[13px] font-medium text-zinc-400">
                  Password
                </label>
                <input
                  id="login-password"
                  className="h-11 w-full rounded-xl border-0 bg-zinc-950/80 px-3.5 text-[15px] text-zinc-100 outline-none ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:ring-2 focus:ring-cyan-500/35"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="rounded-lg bg-red-950/40 px-3 py-2 text-[13px] leading-snug text-red-300/95 ring-1 ring-red-500/20">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-xl bg-cyan-500 text-[15px] font-medium text-zinc-950 transition hover:bg-cyan-400 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-6 flex justify-center text-[13px]">
              <button type="button" onClick={handleCreateAccount} className="text-zinc-500 transition hover:text-zinc-300">
                Create account
              </button>
            </div>
          </div>

          <p className="mt-10 text-center text-[12px] leading-relaxed text-zinc-600">
            <span className="text-zinc-500">Gemini</span>
            <span className="mx-2 text-zinc-700">·</span>
            <span>Encrypted scans</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
