import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../api/AuthContext";

type Mode = "login" | "register";

interface LocationState {
  from?: { pathname: string };
}

const Login = () => {
  const { isAuthenticated, login, register } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (isAuthenticated) {
    const from = (location.state as LocationState | null)?.from?.pathname ?? "/";
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), email.trim(), password);
      }
    } catch (err: unknown) {
      let message = "Request failed. Please try again.";
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === "string") message = detail;
        else if (err.response?.status === 401) message = "Invalid credentials.";
        else if (err.response?.status === 409) message = "Username already exists.";
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (): void => {
    setMode("login");
    setUsername("analyst");
    setPassword("analyst123");
    setError(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950 bg-grid">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-accent-amber/10 blur-3xl" />

      {/* Top brand bar */}
      <header className="relative border-b border-ink-700/50 bg-ink-900/30 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="live-dot bg-accent-amber" />
            <span className="font-display text-lg italic tracking-tight text-ink-50">
              SENTINEL
            </span>
            <span className="label-meta">Fraud Detection Console</span>
          </div>
          <span className="label-meta hidden md:inline">v1.0 · operations</span>
        </div>
      </header>

      <main className="relative mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
        {/* Left: pitch */}
        <section className="reveal flex flex-col justify-center">
          <span className="label-meta mb-4">[ 00 ] credentials</span>
          <h1 className="font-display text-5xl leading-[1.05] text-ink-50 md:text-6xl">
            Catch fraud,
            <br />
            <em className="italic text-accent-amber">in real time.</em>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-ink-300">
            A live operations console for David&apos;s e-commerce platform. Three models,
            one verdict per transaction — engineered for analysts who need signal, not
            noise.
          </p>

          <ul className="mt-10 space-y-3 text-sm text-ink-200">
            <li className="flex items-baseline gap-3">
              <span className="num text-accent-amber">01</span>
              <span>Random Forest, Logistic Regression, and Isolation Forest in parallel.</span>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="num text-accent-amber">02</span>
              <span>Risk-scored alerts with feature attribution per decision.</span>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="num text-accent-amber">03</span>
              <span>Approve, reject, or escalate — full analyst audit trail.</span>
            </li>
          </ul>
        </section>

        {/* Right: auth panel */}
        <section className="reveal flex items-center">
          <div className="panel-bordered w-full max-w-md p-8">
            <div className="flex items-center justify-between">
              <span className="label-meta">[ access ]</span>
              <div className="flex gap-1 rounded border border-ink-700/60 bg-ink-900/50 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className={`px-3 py-1 transition ${
                    mode === "login"
                      ? "bg-accent-amber text-ink-950"
                      : "text-ink-300 hover:text-ink-50"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                  }}
                  className={`px-3 py-1 transition ${
                    mode === "register"
                      ? "bg-accent-amber text-ink-950"
                      : "text-ink-300 hover:text-ink-50"
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            <h2 className="mt-6 font-display text-3xl text-ink-50">
              {mode === "login" ? "Welcome back." : "Create analyst account."}
            </h2>
            <p className="mt-2 text-sm text-ink-400">
              {mode === "login"
                ? "Authenticate to access the console."
                : "Provision a new analyst — full audit access."}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="username" className="label-meta mb-2 block">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  placeholder="analyst"
                />
              </div>

              {mode === "register" && (
                <div>
                  <label htmlFor="email" className="label-meta mb-2 block">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="analyst@example.com"
                  />
                </div>
              )}

              <div>
                <label htmlFor="password" className="label-meta mb-2 block">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="border border-signal-alert/40 bg-signal-alert/10 px-3 py-2 text-sm text-signal-alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Authenticating…"
                  : mode === "login"
                  ? "Sign in →"
                  : "Create account →"}
              </button>
            </form>

            <div className="mt-6 border-t border-ink-700/50 pt-6">
              <button
                type="button"
                onClick={fillDemo}
                className="label-meta w-full text-left transition hover:text-accent-amber"
              >
                → use demo credentials (analyst / analyst123)
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-ink-700/50 bg-ink-900/20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="label-meta">© SENTINEL · david-commerce</span>
          <span className="label-meta">secure · in-memory tokens</span>
        </div>
      </footer>
    </div>
  );
};

export default Login;
