import { TransactionStatus } from "../api/types";

interface StatusBadgeProps {
  status: TransactionStatus;
}

const STATUS_CONFIG: Record<
  TransactionStatus,
  { label: string; cls: string }
> = {
  SAFE: { label: "Safe", cls: "badge-safe" },
  ALERT: { label: "Alert", cls: "badge-alert" },
  UNDER_REVIEW: { label: "Review", cls: "badge-review" },
  CONFIRMED_FRAUD: { label: "Fraud", cls: "badge-alert" },
  APPROVED: { label: "Approved", cls: "badge-safe" },
};

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = STATUS_CONFIG[status] ?? { label: status, cls: "badge-neutral" };
  return <span className={config.cls}>{config.label}</span>;
};

export default StatusBadge;
