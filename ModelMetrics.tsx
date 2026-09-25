import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api/axiosConfig";
import { ModelKey, ModelPerformance } from "../api/types";
import { Panel } from "./Panel";

const MODEL_LABELS: Record<ModelKey, string> = {
  logistic_regression: "Logistic Regression",
  random_forest: "Random Forest",
  isolation_forest: "Isolation Forest",
};

const MODEL_DESCRIPTIONS: Record<ModelKey, string> = {
  logistic_regression:
    "Linear baseline. Calibrated probabilities, fast to retrain, easy to audit.",
  random_forest:
    "Non-linear ensemble. Best F1 in our evaluation; exposes feature importances for the analyst view.",
  isolation_forest:
    "Unsupervised anomaly detector. Learns the shape of normal traffic and flags outliers — useful as a safety net.",
};

const MetricBar = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="flex items-baseline justify-between">
      <span className="label-meta">{label}</span>
      <span className="num text-ink-100">{(value * 100).toFixed(2)}</span>
    </div>
    <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink-700/50">
      <div
        className="h-full bg-accent-amber"
        style={{ width: `${Math.min(100, value * 100)}%` }}
      />
    </div>
  </div>
);

const ConfusionGrid = ({
  matrix,
}: {
  matrix: { tn: number; fp: number; fn: number; tp: number };
}) => {
  const total = matrix.tn + matrix.fp + matrix.fn + matrix.tp || 1;
  const cells = [
    { key: "tn", label: "True Negative", value: matrix.tn, tone: "safe" },
    { key: "fp", label: "False Positive", value: matrix.fp, tone: "warn" },
    { key: "fn", label: "False Negative", value: matrix.fn, tone: "alert" },
    { key: "tp", label: "True Positive", value: matrix.tp, tone: "safe" },
  ] as const;

  const tone = (t: "safe" | "warn" | "alert") =>
    ({
      safe: "border-signal-safe/30 bg-signal-safe/5 text-signal-safe",
      warn: "border-signal-warn/30 bg-signal-warn/5 text-signal-warn",
      alert: "border-signal-alert/30 bg-signal-alert/5 text-signal-alert",
    })[t];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto,1fr,1fr] gap-1 text-[10px]">
        <div />
        <div className="label-meta text-center">Predicted Legit</div>
        <div className="label-meta text-center">Predicted Fraud</div>
      </div>
      <div className="grid grid-cols-[auto,1fr,1fr] gap-1">
        <div className="label-meta flex items-center pr-2">Actual<br />Legit</div>
        {[cells[0], cells[1]].map((c) => (
          <div
            key={c.key}
            className={`rounded-sm border p-3 ${tone(c.tone)}`}
          >
            <div className="num font-display text-2xl">{c.value}</div>
            <div className="label-meta">{c.label}</div>
            <div className="num mt-1 text-[10px] text-ink-300">
              {((c.value / total) * 100).toFixed(1)}%
            </div>
          </div>
        ))}
        <div className="label-meta flex items-center pr-2">Actual<br />Fraud</div>
        {[cells[2], cells[3]].map((c) => (
          <div
            key={c.key}
            className={`rounded-sm border p-3 ${tone(c.tone)}`}
          >
            <div className="num font-display text-2xl">{c.value}</div>
            <div className="label-meta">{c.label}</div>
            <div className="num mt-1 text-[10px] text-ink-300">
              {((c.value / total) * 100).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ModelMetrics = () => {
  const [data, setData] = useState<ModelPerformance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ModelKey>("random_forest");

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const { data: perf } = await api.get<ModelPerformance>("/models/performance");
        setData(perf);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load model performance";
        setError(msg);
      }
    };
    void load();
  }, []);

  const importances = useMemo(() => {
    if (!data?.random_forest?.feature_importances) return [];
    return data.random_forest.feature_importances.slice(0, 10);
  }, [data]);

  if (error) {
    return (
      <div className="panel-bordered p-6 text-sm text-signal-alert">{error}</div>
    );
  }
  if (!data) {
    return <div className="panel-bordered p-6 text-sm text-ink-300">Loading…</div>;
  }

  const m = data[active];

  return (
    <div className="space-y-6 reveal">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-700/40 pb-4">
        <div>
          <div className="label-meta">Model Lab</div>
          <h1 className="mt-1 font-display text-3xl italic text-ink-100">
            How well does each model see fraud?
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-300">
            All three models are trained on the same SMOTE-balanced split.
            Random Forest is the production scorer; the others are kept for
            comparison and as fallback signals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MODEL_LABELS) as ModelKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={[
                "btn",
                active === key ? "border-accent-amber/60 text-accent-amber" : "",
              ].join(" ")}
            >
              {MODEL_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Confusion matrix" index="M1" className="lg:col-span-2">
          <ConfusionGrid matrix={m.confusion_matrix} />
          <p className="mt-4 text-xs text-ink-400">
            {MODEL_DESCRIPTIONS[active]}
          </p>
        </Panel>

        <Panel title="Headline metrics" index="M2">
          <div className="space-y-4">
            <MetricBar label="Precision" value={m.precision} />
            <MetricBar label="Recall" value={m.recall} />
            <MetricBar label="F1 Score" value={m.f1} />
            <MetricBar label="ROC-AUC" value={m.roc_auc} />
          </div>
        </Panel>
      </div>

      {active === "random_forest" && importances.length > 0 && (
        <Panel title="Feature Importance — Random Forest" index="M3">
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <BarChart
                data={importances}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" stroke="#5a6273" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="feature"
                  stroke="#5a6273"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={170}
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
                  formatter={(v: number) => `${(v * 100).toFixed(2)}%`}
                />
                <Bar dataKey="importance" fill="#f59e0b" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}
    </div>
  );
};

export default ModelMetrics;
