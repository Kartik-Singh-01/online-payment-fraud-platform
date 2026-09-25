import { FormEvent, useState } from "react";
import api from "../api/axiosConfig";
import {
  DeviceType,
  FlaggedFeature,
  MerchantCategory,
  TransactionInput,
  TransactionPredictResponse,
} from "../api/types";
import { Panel } from "./Panel";

const CATEGORIES: MerchantCategory[] = [
  "grocery",
  "electronics",
  "fashion",
  "travel",
  "digital_goods",
  "restaurant",
  "gas_station",
  "jewelry",
];

const DEVICES: DeviceType[] = ["mobile", "desktop", "tablet", "unknown"];

const DEFAULTS: TransactionInput = {
  amount: 120,
  merchant_id: "M-AMZN-0001",
  user_id: "U-1234",
  location: "New York, US",
  device_type: "mobile",
  merchant_category: "electronics",
  hour_of_day: new Date().getHours(),
  is_weekend: [0, 6].includes(new Date().getDay()),
  location_risk_score: 0.2,
  transaction_velocity: 1,
  distance_from_home: 5,
};

const FRAUD_SAMPLE: TransactionInput = {
  amount: 1899.5,
  merchant_id: "M-DGTL-9001",
  user_id: "U-9876",
  location: "Lagos, NG",
  device_type: "unknown",
  merchant_category: "digital_goods",
  hour_of_day: 3,
  is_weekend: true,
  location_risk_score: 0.85,
  transaction_velocity: 9,
  distance_from_home: 320,
};

const TransactionForm = () => {
  const [form, setForm] = useState<TransactionInput>(DEFAULTS);
  const [result, setResult] = useState<TransactionPredictResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof TransactionInput>(
    key: K,
    value: TransactionInput[K]
  ): void => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post<TransactionPredictResponse>("/transactions", form);
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 reveal">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-700/40 pb-4">
        <div>
          <div className="label-meta">Manual Capture</div>
          <h1 className="mt-1 font-display text-3xl italic text-ink-100">
            Submit a transaction for scoring
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-300">
            Useful for testing the pipeline end-to-end or replaying a
            customer-reported case. The Random Forest scorer responds in
            real time.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setForm(DEFAULTS)}
            className="btn"
          >
            Use safe sample
          </button>
          <button
            type="button"
            onClick={() => setForm(FRAUD_SAMPLE)}
            className="btn-danger"
          >
            Use risky sample
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Transaction inputs" index="N1" className="lg:col-span-2">
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label-meta">Amount (USD)</span>
              <input
                type="number"
                step="0.01"
                min={0.01}
                required
                value={form.amount}
                onChange={(e) => update("amount", parseFloat(e.target.value || "0"))}
                className="input mt-1"
              />
            </label>
            <label className="block">
              <span className="label-meta">User ID</span>
              <input
                type="text"
                required
                value={form.user_id}
                onChange={(e) => update("user_id", e.target.value)}
                className="input mt-1"
              />
            </label>
            <label className="block">
              <span className="label-meta">Merchant ID</span>
              <input
                type="text"
                required
                value={form.merchant_id}
                onChange={(e) => update("merchant_id", e.target.value)}
                className="input mt-1"
              />
            </label>
            <label className="block">
              <span className="label-meta">Merchant category</span>
              <select
                value={form.merchant_category}
                onChange={(e) =>
                  update("merchant_category", e.target.value as MerchantCategory)
                }
                className="input mt-1"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label-meta">Device type</span>
              <select
                value={form.device_type}
                onChange={(e) => update("device_type", e.target.value as DeviceType)}
                className="input mt-1"
              >
                {DEVICES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label-meta">Location (city, country)</span>
              <input
                type="text"
                value={form.location ?? ""}
                onChange={(e) => update("location", e.target.value)}
                className="input mt-1"
              />
            </label>
            <label className="block">
              <span className="label-meta">Hour of day</span>
              <input
                type="number"
                min={0}
                max={23}
                value={form.hour_of_day ?? 0}
                onChange={(e) => update("hour_of_day", parseInt(e.target.value || "0", 10))}
                className="input mt-1"
              />
            </label>
            <label className="block">
              <span className="label-meta">Weekend?</span>
              <select
                value={form.is_weekend ? "1" : "0"}
                onChange={(e) => update("is_weekend", e.target.value === "1")}
                className="input mt-1"
              >
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
            </label>
            <label className="block">
              <span className="label-meta">Location risk (0–1)</span>
              <input
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={form.location_risk_score}
                onChange={(e) =>
                  update("location_risk_score", parseFloat(e.target.value || "0"))
                }
                className="input mt-1"
              />
            </label>
            <label className="block">
              <span className="label-meta">Velocity (last hour)</span>
              <input
                type="number"
                min={0}
                value={form.transaction_velocity}
                onChange={(e) =>
                  update("transaction_velocity", parseInt(e.target.value || "0", 10))
                }
                className="input mt-1"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="label-meta">Distance from home (km)</span>
              <input
                type="number"
                step="0.1"
                min={0}
                value={form.distance_from_home}
                onChange={(e) =>
                  update("distance_from_home", parseFloat(e.target.value || "0"))
                }
                className="input mt-1"
              />
            </label>

            <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
              {error && (
                <span className="self-center text-xs text-signal-alert">{error}</span>
              )}
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Scoring…" : "Score transaction"}
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Prediction" index="N2">
          {!result ? (
            <div className="flex h-full min-h-[20rem] flex-col items-center justify-center text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
                Awaiting input
              </div>
              <div className="mt-3 font-display text-xl italic text-ink-300">
                Submit a transaction to see the model's verdict.
              </div>
            </div>
          ) : (
            <PredictionResult result={result} />
          )}
        </Panel>
      </div>
    </div>
  );
};

const PredictionResult = ({ result }: { result: TransactionPredictResponse }) => {
  const pct = (result.risk_score * 100).toFixed(2);
  const tone = result.is_fraud
    ? "text-signal-alert border-signal-alert/40 bg-signal-alert/5"
    : "text-signal-safe border-signal-safe/40 bg-signal-safe/5";

  return (
    <div className="space-y-4">
      <div className={`rounded-sm border p-4 ${tone}`}>
        <div className="label-meta">Verdict</div>
        <div className="mt-1 font-display text-3xl italic">
          {result.is_fraud ? "Likely fraud" : "Likely legitimate"}
        </div>
        <div className="mt-1 font-mono text-[11px] tracking-wider opacity-70">
          TX-{String(result.transaction_id).padStart(6, "0")} · model: {result.model_used}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="label-meta">Risk score</span>
          <span className="num font-display text-2xl text-ink-100">{pct}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700/50">
          <div
            className={`h-full ${
              result.risk_score >= 0.66
                ? "bg-signal-alert"
                : result.risk_score >= 0.4
                  ? "bg-signal-warn"
                  : "bg-signal-safe"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div>
        <div className="label-meta">Top contributing features</div>
        <ul className="mt-2 space-y-1.5 text-sm">
          {result.flagged_features.map((f: FlaggedFeature) => (
            <li
              key={f.feature}
              className="flex items-center justify-between border-b border-ink-800/60 pb-1"
            >
              <span className="font-mono text-ink-200">{f.feature}</span>
              <span className="num text-[11px] text-ink-300">
                {(f.importance * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default TransactionForm;
