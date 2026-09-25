import { Transaction } from "../api/types";
import StatusBadge from "./StatusBadge";

interface TransactionTableProps {
  transactions: Transaction[];
  dense?: boolean;
  emptyText?: string;
  onRowClick?: (transaction: Transaction) => void;
}

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatAmount = (amount: number): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);

const RiskMeter = ({ value }: { value: number }) => {
  const pct = Math.min(100, Math.max(0, value * 100));
  const color =
    value >= 0.66 ? "bg-signal-alert" : value >= 0.4 ? "bg-signal-warn" : "bg-signal-safe";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-ink-700/50">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="num w-9 text-right text-[11px] text-ink-200">{value.toFixed(2)}</span>
    </div>
  );
};

const TransactionTable = ({
  transactions,
  dense = false,
  emptyText = "No transactions found.",
  onRowClick,
}: TransactionTableProps) => {
  if (transactions.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-ink-400">{emptyText}</div>
    );
  }

  const padY = dense ? "py-2" : "py-3";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ink-700/50 text-ink-300">
            <th className="label-meta px-3 py-2 font-normal">Time</th>
            <th className="label-meta px-3 py-2 font-normal">User</th>
            <th className="label-meta px-3 py-2 font-normal">Merchant</th>
            <th className="label-meta px-3 py-2 font-normal">Category</th>
            <th className="label-meta px-3 py-2 font-normal">Amount</th>
            <th className="label-meta px-3 py-2 font-normal">Risk</th>
            <th className="label-meta px-3 py-2 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr
              key={tx.id}
              onClick={onRowClick ? () => onRowClick(tx) : undefined}
              className={[
                "border-b border-ink-800/60 transition",
                onRowClick ? "cursor-pointer hover:bg-ink-800/40" : "",
              ].join(" ")}
            >
              <td className={`num px-3 ${padY} text-ink-300`}>{formatTime(tx.timestamp)}</td>
              <td className={`num px-3 ${padY} text-ink-200`}>{tx.user_id}</td>
              <td className={`num px-3 ${padY} text-ink-200`}>{tx.merchant_id}</td>
              <td className={`px-3 ${padY} capitalize text-ink-300`}>
                {tx.merchant_category.replace("_", " ")}
              </td>
              <td className={`num px-3 ${padY} text-ink-100`}>{formatAmount(tx.amount)}</td>
              <td className={`px-3 ${padY}`}>
                <RiskMeter value={tx.risk_score} />
              </td>
              <td className={`px-3 ${padY}`}>
                <StatusBadge status={tx.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionTable;