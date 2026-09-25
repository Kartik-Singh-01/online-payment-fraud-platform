import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api/axiosConfig";
import { DashboardStats, TransactionStatus } from "../api/types";
import Layout from "../components/Layout";
import { Panel, Kpi } from "../components/Panel";

interface FilterState {
  start_date: string;
  end_date: string;
  status: TransactionStatus | "";
}

const STATUS_OPTIONS: { value: TransactionStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "SAFE", label: "Safe" },
  { value: "ALERT", label: "Alert" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "CONFIRMED_FRAUD", label: "Confirmed fraud" },
  { value: "APPROVED", label: "Approved" },
];

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const Reports = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    start_date: "",
    end_date: "",
    status: "",
  });
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const { data } = await api.get<DashboardStats>("/dashboard/stats");
        if (!cancelled) {
          setStats(data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Failed to load report data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    if (!stats) return null;
    const totals = stats.daily_volume.reduce(
      (acc, row) => {
        acc.fraud += row.fraud;
        acc.legit += row.legitimate;
        return acc;
      },
      { fraud: 0, legit: 0 }
    );
    const total = totals.fraud + totals.legit;
    const rate = total > 0 ? (totals.fraud / total) * 100 : 0;
    const peak = stats.daily_volume.reduce(
      (max, row) => (row.fraud > max.fraud ? row : max),
      { date: "", fraud: 0, legitimate: 0 }
    );
    return { ...totals, total, rate, peak };
  }, [stats]);

  const trendData = useMemo(() => {
    if (!stats) return [];
    return stats.daily_volume.map((row) => ({
      label: formatDate(row.date),
      fraud: row.fraud,
      legitimate: row.legitimate,
      rate: row.fraud + row.legitimate > 0
        ? Number(((row.fraud / (row.fraud + row.legitimate)) * 100).toFixed(2))
        : 0,
    }));
  }, [stats]);

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    setExportError(null);
    try {
      const params: Record<string, string> = { format: "csv" };
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.status) params.status = filters.status;

      const response = await api.get<Blob>("/reports/export", {
        params,
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sentinel-transactions-${stamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed. Adjust filters and retry.");
    } finally {
      setExporting(false);
    }
  };

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]): void => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  return (
    <Layout>
      {/* Page header */}
      <div className="reveal mb-10">
        <span className="label-meta">[ section / 04 ]</span>
        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <h1 className="font-display text-4xl leading-tight text-ink-50 md:text-5xl">
            Reports <em className="italic text-accent-amber">&amp; exports.</em>
          </h1>
          <p className="max-w-md text-sm text-ink-300">
            Filtered transaction exports, monthly aggregates, and fraud-trend movement
            for analyst review and compliance audit trails.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 border border-signal-alert/40 bg-signal-alert/10 px-4 py-3 text-sm text-signal-alert">
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="reveal mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Total — 7d"
          value={loading ? "—" : (summary?.total ?? 0).toLocaleString()}
          accent={false}
        />
        <Kpi
          label="Fraud detected"
          value={loading ? "—" : (summary?.fraud ?? 0).toLocaleString()}
          accent
        />
        <Kpi
          label="Legitimate"
          value={loading ? "—" : (summary?.legit ?? 0).toLocaleString()}
          accent={false}
        />
        <Kpi
          label="Fraud rate"
          value={loading ? "—" : `${(summary?.rate ?? 0).toFixed(2)}%`}
          accent
        />
      </div>

      {/* Export panel + trend chart */}
      <div className="reveal grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="CSV export" index="01" className="lg:col-span-1">
          <div className="space-y-4">
            <div>
              <label htmlFor="rep-start" className="label-meta mb-2 block">
                Start date
              </label>
              <input
                id="rep-start"
                type="date"
                value={filters.start_date}
                onChange={(e) => updateFilter("start_date", e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="rep-end" className="label-meta mb-2 block">
                End date
              </label>
              <input
                id="rep-end"
                type="date"
                value={filters.end_date}
                onChange={(e) => updateFilter("end_date", e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="rep-status" className="label-meta mb-2 block">
                Status filter
              </label>
              <select
                id="rep-status"
                value={filters.status}
                onChange={(e) =>
                  updateFilter("status", e.target.value as FilterState["status"])
                }
                className="input"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="btn btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? "Generating…" : "Download CSV →"}
            </button>

            {exportError && (
              <div className="border border-signal-alert/40 bg-signal-alert/10 px-3 py-2 text-xs text-signal-alert">
                {exportError}
              </div>
            )}

            <p className="border-t border-ink-700/50 pt-4 text-xs leading-relaxed text-ink-400">
              Empty filters export the full transaction set. Output is streamed
              client-side and includes the analyst review status for every row.
            </p>
          </div>
        </Panel>

        <Panel title="Fraud trend — last 7d" index="02" className="lg:col-span-2">
          {loading || trendData.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-ink-400">
              {loading ? "Loading trend…" : "No data."}
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="repFraud" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="repLegit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4ade80" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0a0e16",
                      border: "1px solid #1f2937",
                      fontSize: 12,
                      borderRadius: 0,
                    }}
                    labelStyle={{ color: "#e5e7eb" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="legitimate"
                    stroke="#4ade80"
                    strokeWidth={1.5}
                    fill="url(#repLegit)"
                  />
                  <Area
                    type="monotone"
                    dataKey="fraud"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    fill="url(#repFraud)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      {/* Daily breakdown table */}
      <div className="reveal mt-6">
        <Panel title="Daily breakdown" index="03">
          {loading ? (
            <div className="py-8 text-center text-sm text-ink-400">Loading…</div>
          ) : trendData.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-400">No data.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-700/50 text-left">
                    <th className="label-meta py-2 pr-4">Date</th>
                    <th className="label-meta py-2 pr-4 text-right">Fraud</th>
                    <th className="label-meta py-2 pr-4 text-right">Legitimate</th>
                    <th className="label-meta py-2 pr-4 text-right">Total</th>
                    <th className="label-meta py-2 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {trendData.map((row) => {
                    const total = row.fraud + row.legitimate;
                    return (
                      <tr
                        key={row.label}
                        className="border-b border-ink-800/60 transition hover:bg-ink-800/30"
                      >
                        <td className="py-3 pr-4 text-ink-100">{row.label}</td>
                        <td className="num py-3 pr-4 text-right text-signal-alert">
                          {row.fraud}
                        </td>
                        <td className="num py-3 pr-4 text-right text-signal-safe">
                          {row.legitimate}
                        </td>
                        <td className="num py-3 pr-4 text-right text-ink-100">
                          {total}
                        </td>
                        <td className="num py-3 text-right text-ink-200">
                          {row.rate.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </Layout>
  );
};

export default Reports;
