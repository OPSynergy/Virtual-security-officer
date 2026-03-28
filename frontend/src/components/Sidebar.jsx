import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import vsoRectLogo from "../assets/vso.png";
import vsoSquareLogo from "../assets/vso_sq.png";
import { useAuth } from "../context/AuthContext";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-5.5h5V20" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden>
      <path d="M4 12a8 8 0 1 0 2.34-5.66" />
      <path d="M4 4v4h4" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function FindingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h6M8 9h4" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden>
      <path d="M4 5h16v11H8l-4 4V5z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  );
}

function PowerOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M12 2v10" />
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    </svg>
  );
}

function SidebarNavLink({ to, end, label, icon: Icon, isCollapsed, linkClass }) {
  const wrapRef = useRef(null);
  const [tipPos, setTipPos] = useState(null);

  const updateTip = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTipPos({ left: r.right + 10, top: r.top + r.height / 2 });
  };

  const clearTip = () => setTipPos(null);

  useEffect(() => {
    if (!tipPos || !isCollapsed) return;
    const sync = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setTipPos({ left: r.right + 10, top: r.top + r.height / 2 });
    };
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [tipPos, isCollapsed]);

  return (
    <>
      <NavLink
        to={to}
        end={end}
        title={isCollapsed ? label : undefined}
        onMouseEnter={isCollapsed ? updateTip : undefined}
        onMouseLeave={isCollapsed ? clearTip : undefined}
        onFocus={isCollapsed ? updateTip : undefined}
        onBlur={isCollapsed ? clearTip : undefined}
        className={({ isActive }) => `${linkClass({ isActive })}`}
      >
        <span
          ref={wrapRef}
          className={`flex w-full items-center ${isCollapsed ? "justify-center" : "justify-start gap-3"}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center [&>svg]:block">
            <Icon />
          </span>
          {!isCollapsed && <span>{label}</span>}
        </span>
      </NavLink>
      {isCollapsed &&
        tipPos &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[10050] whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm font-medium text-zinc-100 shadow-xl ring-1 ring-black/40"
            style={{
              left: tipPos.left,
              top: tipPos.top,
              transform: "translateY(-50%)",
            }}
          >
            {label}
          </div>,
          document.body
        )}
    </>
  );
}

function SidebarChatNav({ isCollapsed, linkClass }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const isChatRoute = location.pathname === "/chat";

  const updateMenuPos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({ left: r.left, top: r.bottom + 8, width: Math.max(r.width, 168) });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPos();
    const sync = () => updateMenuPos();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [open, updateMenuPos, isCollapsed]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e) {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  function toggleMenu() {
    setOpen((v) => {
      const next = !v;
      if (next && triggerRef.current) {
        const r = triggerRef.current.getBoundingClientRect();
        setMenuPos({ left: r.left, top: r.bottom + 8, width: Math.max(r.width, 168) });
      } else if (!next) {
        setMenuPos(null);
      }
      return next;
    });
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="AI Chat menu"
        title={isCollapsed ? "AI Chat" : undefined}
        onClick={toggleMenu}
        className={linkClass({ isActive: isChatRoute })}
      >
        <span className={`flex w-full items-center ${isCollapsed ? "justify-center" : "justify-start gap-3"}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center [&>svg]:block">
            <ChatIcon />
          </span>
          {!isCollapsed && (
            <>
              <span className="min-w-0 flex-1 text-left">AI Chat</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </span>
      </button>
      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[10050] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl ring-1 ring-black/40"
            style={{ left: menuPos.left, top: menuPos.top, minWidth: menuPos.width }}
          >
            <Link
              role="menuitem"
              to="/chat"
              className="block px-3 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 hover:text-cyan-300"
              onClick={() => setOpen(false)}
            >
              Chat
            </Link>
            <Link
              role="menuitem"
              to="/chat"
              state={{ openPastChats: true }}
              className="block px-3 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 hover:text-cyan-300"
              onClick={() => setOpen(false)}
            >
              Past chats
            </Link>
          </div>,
          document.body
        )}
    </div>
  );
}

export default function Sidebar() {
  const { user, isDemoMode, signOut, setDemoMode } = useAuth();
  const navigate = useNavigate();
  const sidebarRef = useRef(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const linkClass = ({ isActive }) =>
    `rounded-lg text-lg font-semibold transition ${
      isCollapsed
        ? "flex w-full items-center justify-center pl-2 pr-0 py-3"
        : "flex w-full items-center justify-start pl-4 pr-0 py-3.5"
    } ${
      isActive
        ? "bg-zinc-800/90 text-cyan-400 ring-1 ring-zinc-700/80"
        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
    }`;

  const displayName = isDemoMode
    ? "demo@virtualsecurityofficer.local"
    : user?.user_metadata?.full_name || user?.email || "Signed in";

  const profileInitial = useMemo(() => {
    const raw = displayName.trim();
    if (!raw) return "?";
    return raw[0].toUpperCase();
  }, [displayName]);

  async function handleLogout() {
    setDemoMode(false);
    await signOut();
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    if (isCollapsed) return;
    function onDocMouseDown(e) {
      if (!sidebarRef.current) return;
      if (sidebarRef.current.contains(e.target)) return;
      setIsCollapsed(true);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [isCollapsed]);

  return (
    <aside
      ref={sidebarRef}
      className="flex h-full min-h-0 shrink-0 flex-col overflow-x-hidden overflow-y-hidden border-r border-zinc-800/80 bg-zinc-950 transition-[width] duration-200"
      style={{ width: isCollapsed ? 84 : 288 }}
    >
      <button
        type="button"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={() => setIsCollapsed((v) => !v)}
        className={`mb-6 w-full shrink-0 ${isCollapsed ? "pl-3 pr-0 pt-6" : "pl-5 pr-0 pt-7"} focus:outline-none`}
      >
        <img
          src={isCollapsed ? vsoSquareLogo : vsoRectLogo}
          alt="Virtual Security Officer"
          className="h-auto w-full object-contain"
          draggable={false}
        />
      </button>

      <nav
        className={`min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pb-2 [scrollbar-gutter:stable] ${isCollapsed ? "pl-2 pr-0" : "pl-4 pr-0"}`}
      >
        <SidebarNavLink to="/" end label="Home" icon={HomeIcon} isCollapsed={isCollapsed} linkClass={linkClass} />
        <SidebarNavLink to="/alerts" label="Findings" icon={FindingsIcon} isCollapsed={isCollapsed} linkClass={linkClass} />
        <SidebarNavLink to="/history" label="History" icon={HistoryIcon} isCollapsed={isCollapsed} linkClass={linkClass} />
        <SidebarChatNav isCollapsed={isCollapsed} linkClass={linkClass} />
      </nav>

      {!isCollapsed && (
        <div className="mt-auto w-full min-w-0 shrink-0 overflow-x-hidden border-t border-zinc-800/80 pl-4 pr-0 pb-6 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <p
              className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200"
              title={displayName}
            >
              {displayName}
            </p>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="shrink-0 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-red-950/40 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
              title="Log out"
              aria-label="Log out"
            >
              <PowerOffIcon />
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-600">Powered by Google Gemini · v1.0</p>
        </div>
      )}

      {isCollapsed && (
        <div className="mt-auto w-full min-w-0 shrink-0 overflow-x-hidden border-t border-zinc-800/80 pl-2 pr-0 pb-4 pt-3">
          <div className="mx-auto flex w-full max-w-full justify-center">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-600/35 to-zinc-800 text-lg font-bold uppercase tracking-tight text-cyan-200 ring-1 ring-zinc-700"
              title={displayName}
              aria-label={displayName}
            >
              {profileInitial}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
