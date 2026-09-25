import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../api/AuthContext";

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS: { to: string; label: string; index: string }[] = [
  { to: "/", label: "Console", index: "01" },
  { to: "/alerts", label: "Alerts", index: "02" },
  { to: "/models", label: "Models", index: "03" },
  { to: "/reports", label: "Reports", index: "04" },
  { to: "/submit", label: "Submit", index: "05" },
];

const Layout = ({ children }: LayoutProps) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const currentNav = NAV_ITEMS.find((n) => n.to === location.pathname) ?? NAV_ITEMS[0];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-ink-700/50 bg-ink-900/40 lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5 border-b border-ink-700/50 px-5 py-5">
          <div className="grid h-7 w-7 place-items-center rounded-sm bg-accent-amber/15 text-accent-amber">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <path d="M12 2L3 6v6c0 5 3.8 9.5 9 11 5.2-1.5 9-6 9-11V6l-9-4z" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg italic text-ink-100">Sentinel</div>
            <div className="label-meta -mt-0.5">Fraud Console</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4">
          <div className="label-meta px-2 pb-2">Navigation</div>
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    [
                      "group flex items-center justify-between rounded-sm px-3 py-2 text-sm transition",
                      isActive
                        ? "bg-ink-800/80 text-ink-100"
                        : "text-ink-300 hover:bg-ink-800/40 hover:text-ink-100",
                    ].join(" ")
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="flex items-center gap-3">
                        <span
                          className={[
                            "font-mono text-[10px]",
                            isActive ? "text-accent-amber" : "text-ink-400",
                          ].join(" ")}
                        >
                          {item.index}
                        </span>
                        <span className="font-medium tracking-wide">{item.label}</span>
                      </span>
                      {isActive && (
                        <span className="h-1 w-1 rounded-full bg-accent-amber" />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-ink-700/50 px-4 py-4">
          <div className="label-meta">Operator</div>
          <div className="mt-1 truncate text-sm text-ink-100">{user?.username ?? "—"}</div>
          <div className="mt-0.5 truncate text-xs text-ink-400">{user?.email ?? ""}</div>
          <button
            type="button"
            onClick={logout}
            className="btn mt-3 w-full justify-center"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-700/50 bg-ink-950/80 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="lg:hidden">
              <div className="font-display text-base italic">Sentinel</div>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              <span className="font-mono text-[10px] text-ink-400">/</span>
              <span className="label-meta">{currentNav.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="hidden items-center gap-2 text-ink-300 sm:flex">
              <span className="live-dot" />
              <span className="font-mono uppercase tracking-wider">Live</span>
            </span>
            <span className="num text-ink-300">
              {new Date().toLocaleString(undefined, {
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </header>

        <main className="relative flex-1 px-6 py-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-grid bg-grid opacity-[0.35]"
          />
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
