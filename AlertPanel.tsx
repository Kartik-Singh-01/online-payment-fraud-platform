import { useEffect, useMemo, useState } from "react";
import api from "../api/axiosConfig";
import { Transaction } from "../api/types";
import { Panel } from "./Panel";
import StatusBadge from "./StatusBadge";

type RawAlert = {
  id: number;
  user_id: string;
  amount: number;
  merchant_id: string;
  merchant_category: string;
  location: string | null;
  device_type: string;
  hour_of_day: number;
  is_weekend: number;
  location_risk_score: number;
  transaction_velocity: number;
  distance_from_home: number;
  timestamp: string;
  is_fraud: number;
  risk_score: number;
  status: Transaction["status"];
  flagged_features: string | null;
  analyst_decision: string | null;
  reviewed_at: string | null;
};

const normalize = (a: RawAlert): Transaction => ({
  ...a,
  is_fraud: Boolean(a.is_fraud),
  is_weekend: Boolean(a.is_weekend),
  flagged_features: (() => {
    try {
      return a.flagged_features ? JSON.parse(a.flagged_features) : [];
    } catch {
      return [];
    }
  })(),
});

const AlertPanel = () => {
  const [alerts, setAlerts] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [minRisk, setMinRisk] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAlerts = async (): Promise<void> => {
    setLoading(true);
    try {
      // Guard NaN — if the user typed a partial decimal, parseFloat can
      // produce NaN which Axios serialises as the literal string "NaN",
      // making FastAPI's ge=0.0 validator reject the request with 422.
      const safeMinRisk = Number.isFinite(minRisk) ? minRisk : 0;
      const params: Record<string, string | number> = { min_risk: safeMinRisk };
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const { data } = await api.get<RawAlert[]>("/alerts", { params });
      setAlerts(data.map(normalize));
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load alerts";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = (): void => {
    void fetchAlerts();
  };

  const handleAction = async (
    action: "approve" | "reject" | "investigate"
  ): Promise<void> => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.patch(`/transactions/${selected.id}/review`, { action });

      // Optimistic local update so counters reflect the action immediately
      // without waiting for the re-fetch to complete.
      const statusMap: Record<string, string> = {
        approve: "APPROVED",
        reject: "CONFIRMED_FRAUD",
        investigate: "UNDER_REVIEW",
      };
      const nextStatus = statusMap[action] as Transaction["status"];
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === selected.id ? { ...a, status: nextStatus } : a
        )
      );

      setSelected(null);
      await fetchAlerts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const stats = useMemo(() => {
    const total = alerts.length;
    const high = alerts.filter((a) => a.risk_score >= 0.8).length;
    const review = alerts.filter((a) => a.status === "UNDER_REVIEW").length;
    return { total, high, review };
  }, [alerts]);

  return (
    <div className="space-y-6 reveal">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-700/40 pb-4">
        <div>
          <div className="label-meta">Alert Queue</div>
          <h1 className="mt-1 font-display text-3xl italic text-ink-100">
            Triage suspicious activity
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-300">
            Filter, inspect, and resolve flagged transactions. Approving marks
            the transaction legitimate; rejecting confirms fraud.
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <div>
            <div className="label-meta">Total</div>
            <div className="num text-lg text-ink-100">{stats.total}</div>
          </div>
          <div>
            <div className="label-meta">High risk</div>
            <div className="num text-lg text-signal-alert">{stats.high}</div>
          </div>
          <div>
            <div className="label-meta">Reviewing</div>
            <div className="num text-lg text-signal-warn">{stats.review}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Panel title="Filters" index="F">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="label-meta">Min risk score</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={minRisk}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setMinRisk(Number.isFinite(val) ? Math.min(1, Math.max(0, val)) : 0);
              }}
              className="input mt-1"
            />
          </label>
          <label className="block">
            <span className="label-meta">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input mt-1"
            >
              <option value="">All flagged</option>
              <option value="ALERT">Alert</option>
              <option value="UNDER_REVIEW">Under review</option>
              <option value="CONFIRMED_FRAUD">Confirmed fraud</option>
              <option value="APPROVED">Approved</option>
            </select>
          </label>
          <label className="block">
            <span className="label-meta">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input mt-1"
            />
          </label>
          <label className="block">
            <span className="label-meta">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input mt-1"
            />
          </label>
          <div className="flex items-end">
            <button type="button" onClick={handleApply} className="btn-primary w-full">
              Apply
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Flagged Transactions" index="Q">
        {error && <div className="mb-3 text-sm text-signal-alert">{error}</div>}
        {loading ? (
          <div className="py-10 text-center text-sm text-ink-400">Loading…</div>
        ) : alerts.length === 0 ? (
          <div className="py-10 text-center text-sm text-ink-400">
            No alerts matching these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-700/50 text-ink-300">
                  <th className="label-meta px-3 py-2 font-normal">Time</th>
                  <th className="label-meta px-3 py-2 font-normal">Merchant</th>
                  <th className="label-meta px-3 py-2 font-normal">Amount</th>
                  <th className="label-meta px-3 py-2 font-normal">Location</th>
                  <th className="label-meta px-3 py-2 font-normal">Risk</th>
                  <th className="label-meta px-3 py-2 font-normal">Status</th>
                  <th className="label-meta px-3 py-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {alerts.map((tx) => (
                  <tr
                    key={tx.id}
                    className="cursor-pointer border-b border-ink-800/60 transition hover:bg-ink-800/40"
                    onClick={() => setSelected(tx)}
                  >
                    <td className="num px-3 py-2 text-ink-300">
                      {new Date(tx.timestamp).toLocaleString(undefined, {
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="num px-3 py-2 text-ink-200">{tx.merchant_id}</td>
                    <td className="num px-3 py-2 text-ink-100">
                      ${tx.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-ink-300">{tx.location ?? "—"}</td>
                    <td className="num px-3 py-2 text-signal-alert">
                      {(tx.risk_score * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="font-mono text-[10px] text-ink-400">→</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Detail modal */}
      {selected && (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="panel-bordered w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-ink-700/50 px-5 py-3">
              <div>
                <div className="label-meta">Alert detail</div>
                <h3 className="font-display text-lg italic text-ink-100">
                  TX-{String(selected.id).padStart(6, "0")}
                </h3>
              </div>
              <StatusBadge status={selected.status} />
            </header>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div>
                <div className="label-meta">Risk score</div>
                <div className="num mt-1 font-display text-3xl text-signal-alert">
                  {(selected.risk_score * 100).toFixed(2)}
                </div>
                <div className="mt-1 text-[11px] text-ink-400">/ 100</div>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="label-meta">Amount</span>
                <span className="num text-ink-100">${selected.amount.toFixed(2)}</span>
                <span className="label-meta">Merchant</span>
                <span className="num text-ink-200">{selected.merchant_id}</span>
                <span className="label-meta">User</span>
                <span className="num text-ink-200">{selected.user_id}</span>
                <span className="label-meta">Device</span>
                <span className="text-ink-200 capitalize">{selected.device_type}</span>
                <span className="label-meta">Location</span>
                <span className="text-ink-200">{selected.location ?? "—"}</span>
                <span className="label-meta">Distance</span>
                <span className="num text-ink-200">
                  {selected.distance_from_home.toFixed(0)} km
                </span>
                <span className="label-meta">Velocity</span>
                <span className="num text-ink-200">{selected.transaction_velocity}</span>
              </div>
            </div>

            <div className="border-t border-ink-700/50 p-5">
              <div className="label-meta">Top contributing features</div>
              <div className="mt-2 space-y-2">
                {selected.flagged_features.length === 0 ? (
                  <div className="text-sm text-ink-400">No feature attribution available.</div>
                ) : (
                  selected.flagged_features.map((f) => (
                    <div
                      key={f.feature}
                      className="flex items-center justify-between border-b border-ink-800/60 pb-1.5 text-sm"
                    >
                      <span className="font-mono text-ink-200">{f.feature}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-ink-300">value: </span>
                        <span className="num text-ink-100">
                          {typeof f.value === "number" ? f.value.toFixed(2) : f.value}
                        </span>
                        <span className="num w-14 text-right text-ink-300">
                          {(f.importance * 100).toFixed(1)}%
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {selected.analyst_decision && (
              <div className="border-t border-ink-700/50 px-5 py-3">
                <div className="label-meta">Last decision</div>
                <div className="mt-1 text-sm text-ink-200">{selected.analyst_decision}</div>
              </div>
            )}

            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-700/50 p-4">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="btn"
                disabled={submitting}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleAction("investigate")}
                className="btn"
                disabled={submitting}
              >
                Request investigation
              </button>
              <button
                type="button"
                onClick={() => handleAction("approve")}
                className="btn-primary"
                disabled={submitting}
              >
                Approve (legit)
              </button>
              <button
                type="button"
                onClick={() => handleAction("reject")}
                className="btn-danger"
                disabled={submitting}
              >
                Reject (fraud)
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertPanel;