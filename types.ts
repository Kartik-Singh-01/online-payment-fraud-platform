// Shared TypeScript types mirroring the backend Pydantic schemas.

export type TransactionStatus =
  | "SAFE"
  | "ALERT"
  | "UNDER_REVIEW"
  | "CONFIRMED_FRAUD"
  | "APPROVED";

export type DeviceType = "mobile" | "desktop" | "tablet" | "unknown";

export type MerchantCategory =
  | "grocery"
  | "electronics"
  | "fashion"
  | "travel"
  | "digital_goods"
  | "restaurant"
  | "gas_station"
  | "jewelry";

export interface FlaggedFeature {
  feature: string;
  importance: number;
  value: number | string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Transaction {
  id: number;
  user_id: string;
  amount: number;
  merchant_id: string;
  merchant_category: string;
  location: string | null;
  device_type: string;
  hour_of_day: number;
  is_weekend: boolean;
  location_risk_score: number;
  transaction_velocity: number;
  distance_from_home: number;
  timestamp: string;
  is_fraud: boolean;
  risk_score: number;
  status: TransactionStatus;
  flagged_features: FlaggedFeature[];
  analyst_decision: string | null;
  reviewed_at: string | null;
}

export interface TransactionPredictResponse {
  transaction_id: number;
  is_fraud: boolean;
  risk_score: number;
  model_used: string;
  flagged_features: FlaggedFeature[];
  status: TransactionStatus;
}

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardStats {
  kpis: {
    total_today: number;
    fraud_today: number;
    legit_today: number;
    fraud_rate: number;
  };
  daily_volume: { date: string; fraud: number; legitimate: number }[];
  type_distribution: { type: string; count: number }[];
  top_fraud_merchants: { merchant_id: string; count: number }[];
  recent: Transaction[];
}

export interface ConfusionMatrix {
  tn: number;
  fp: number;
  fn: number;
  tp: number;
}

export interface ModelMetric {
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number;
  confusion_matrix: ConfusionMatrix;
  feature_importances?: { feature: string; importance: number }[];
}

export type ModelKey = "logistic_regression" | "random_forest" | "isolation_forest";

export type ModelPerformance = Record<ModelKey, ModelMetric>;

export interface TransactionInput {
  amount: number;
  merchant_id: string;
  user_id: string;
  location?: string;
  device_type: DeviceType;
  merchant_category: MerchantCategory;
  hour_of_day?: number;
  is_weekend?: boolean;
  location_risk_score: number;
  transaction_velocity: number;
  distance_from_home: number;
}
