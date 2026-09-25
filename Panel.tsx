import { ReactNode } from "react";

interface PanelProps {
  children: ReactNode;
  title?: string;
  index?: string;
  trailing?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const Panel = ({
  children,
  title,
  index,
  trailing,
  className = "",
  bodyClassName = "",
}: PanelProps) => (
  <section className={`panel-bordered ${className}`}>
    {(title || trailing) && (
      <header className="flex items-center justify-between border-b border-ink-700/50 px-4 py-3">
        <div className="flex items-baseline gap-3">
          {index && <span className="font-mono text-[10px] text-ink-400">{index}</span>}
          {title && (
            <h2 className="font-display text-sm uppercase tracking-[0.2em] text-ink-100">
              {title}
            </h2>
          )}
        </div>
        {trailing && <div className="flex items-center gap-2">{trailing}</div>}
      </header>
    )}
    <div className={`p-4 ${bodyClassName}`}>{children}</div>
  </section>
);

interface KpiProps {
  label: string;
  value: string;
  delta?: string;
  tone?: "default" | "alert" | "warn" | "safe";
  index?: string;
}

const TONE: Record<NonNullable<KpiProps["tone"]>, string> = {
  default: "text-ink-100",
  alert: "text-signal-alert",
  warn: "text-signal-warn",
  safe: "text-signal-safe",
};

export const Kpi = ({ label, value, delta, tone = "default", index }: KpiProps) => (
  <div className="panel-bordered relative overflow-hidden p-4">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink-500/30 to-transparent" />
    <div className="flex items-start justify-between">
      <span className="label-meta">{label}</span>
      {index && <span className="font-mono text-[10px] text-ink-500">{index}</span>}
    </div>
    <div className={`mt-3 font-display text-3xl font-medium leading-none ${TONE[tone]}`}>
      <span className="num">{value}</span>
    </div>
    {delta && (
      <div className="mt-2 font-mono text-[11px] text-ink-300">{delta}</div>
    )}
  </div>
);
