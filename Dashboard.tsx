import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api/axiosConfig";
import { DashboardStats } from "../api/types";
import { Kpi, Panel } from "./Panel";
import TransactionTable from "./TransactionTable";

const PIE_COLORS = ["#f59e0b", "#60a5fa", "#4ade80", "#a78bfa", "#f472b6", "#22d3ee", "#facc15", "#fb7185"];

const fmt = new Intl.NumberFormat();

const formatDateLabel = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
};

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (): Promise<void> => {
    try {
      const { data } = await api.get<DashboardStats>("/dashboard/stats");
      setStats(data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard";
      setError(msg);
    }
  };

  useEffect(() => {
    void refresh();
    const id = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(id);
  }, []);

  if (error) {
    return (
      <div className="panel-bordered p-6 text-sm text-signal-alert">
        Failed to load dashboard: {error}
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="grid gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="panel-bordered h-28 animate-pulse bg-ink-800/40"
          />
        ))}
      </div>
    );
  }

  const fraudRatePct = (stats.kpis.fraud_rate * 100).toFixed(2);
  const fraudTone = stats.kpis.fraud_today > 0 ? "alert" : "safe";

  return (
    <div className="space-y-6 reveal">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-700/40 pb-4">
        <div>
          <div className="label-meta">Operations Console</div>
          <h1 className="mt-1 font-display text-3xl italic text-ink-100">
            Today's transaction signal
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-300">
            Real-time scoring across David's e-commerce ledger. Anomalies are
            triaged on arrival; analyst review closes the loop.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-400">
          <span className="font-mono uppercase tracking-wider">Auto-refresh</span>
          <span className="num">15s</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 lg:grid-cols-4">
        <Kpi index="01" label="Total Today" value={fmt.format(stats.kpis.total_today)} />
        <Kpi
          index="02"
          label="Fraud Detected"
          value={fmt.format(stats.kpis.fraud_today)}
          tone={fraudTone}
          delta={`${fraudRatePct}% of volume`}
        />
        <Kpi
          index="03"
          label="Legitimate"
          value={fmt.format(stats.kpis.legit_today)}
          tone="safe"
        />
        <Kpi
          index="04"
          label="Fraud Rate"
          value={`${fraudRatePct}%`}
          tone={stats.kpis.fraud_rate > 0.05 ? "alert" : "warn"}
          delta="Rolling, today UTC"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Volume — Last 7 Days"
          index="A"
          className="lg:col-span-2"
          trailing={
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-ink-200">
                <span className="h-2 w-2 rounded-sm bg-signal-info" /> Legit
              </span>
              <span className="flex items-center gap-1.5 text-ink-200">
                <span className="h-2 w-2 rounded-sm bg-signal-alert" /> Fraud
              </span>
            </div>
          }
        >
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <AreaChart data={stats.daily_volume} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="legitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  stroke="#5a6273"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#5a6273" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#0c0e12",
                    border: "1px solid #272c36",
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                  labelFormatter={formatDateLabel}
                />
                <Area
                  type="monotone"
                  dataKey="legitimate"
                  stroke="#60a5fa"
                  strokeWidth={1.5}
                  fill="url(#legitGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="fraud"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  fill="url(#fraudGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Category Mix" index="B">
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <PieChart>
                <Tooltip
                  contentStyle={{
                    background: "#0c0e12",
                    border: "1px solid #272c36",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                />
                <Pie
                  data={stats.type_distribution}
                  dataKey="count"
                  nameKey="type"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  stroke="#08090b"
                >
                  {stats.type_distribution.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-300">
            {stats.type_distribution.slice(0, 6).map((t, idx) => (
              <span key={t.type} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
                />
                <span className="capitalize">{t.type.replace("_", " ")}</span>
                <span className="num text-ink-400">{t.count}</span>
              </span>
            ))}
          </div>
        </Panel>
      </div>

      {/* Top fraud merchants */}
      <Panel title="Top Fraud-Flagged Merchants" index="C">
        {stats.top_fraud_merchants.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink-400">
            No merchants currently flagged.
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <BarChart
                data={stats.top_fraud_merchants}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" stroke="#5a6273" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="merchant_id"
                  stroke="#5a6273"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0c0e12",
                    border: "1px solid #272c36",
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                  cursor={{ fill: "rgba(245,158,11,0.06)" }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      {/* Recent transactions */}
      <Panel title="Recent Activity" index="D">
        <TransactionTable
          transactions={stats.recent}
          dense
          emptyText="No recent transactions yet — submit one from the Submit tab."
        />
      </Panel>
    </div>
  );
};

export default Dashboard;
