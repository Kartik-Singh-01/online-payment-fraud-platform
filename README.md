# SentinelX — Online Payment Fraud Detection Platform

A full-stack ML-powered fraud detection dashboard for **David's e-commerce platform**. Real-time transaction scoring with three classifiers, an analyst review queue with feature attribution, and CSV export for compliance.

---

## The scenario

David runs an e-commerce platform processing thousands of transactions per day. Manual review can't keep up, and chargebacks from missed fraud are eroding margin. SENTINEL gives his analyst team a single console where every incoming transaction is scored in real time, flagged when risk crosses threshold, and routed to a human reviewer with the model's reasoning attached. Analysts approve, reject, or escalate — every decision is logged, every model performance shift is visible, every export is a click away.

---

## Tech stack

**Backend**
- FastAPI (async/await throughout)
- scikit-learn — Logistic Regression, Random Forest, Isolation Forest
- imbalanced-learn (SMOTE) for class rebalancing
- pandas + numpy — feature engineering
- SQLite (stdlib `sqlite3`) — zero-config persistence
- python-jose + passlib (bcrypt) — JWT auth
- python-dotenv — config

**Frontend**
- React 18 + Vite + TypeScript (strict mode, no `any`)
- Tailwind CSS — custom dark "operations console" theme
- Recharts — visualizations
- Axios — HTTP client with JWT interceptor (in-memory token, no localStorage)

---

## Folder structure

```
fraud-detection/
├── backend/
│   ├── main.py                  # FastAPI entry, CORS, lifespan init
│   ├── auth.py                  # JWT + bcrypt utilities
│   ├── database.py              # SQLite connection + schema
│   ├── seed.py                  # Demo user + 200 sample transactions
│   ├── .env                     # SECRET_KEY, DB path, model path
│   ├── requirements.txt
│   ├── routes/
│   │   ├── auth.py              # /auth/register, /auth/login
│   │   ├── transactions.py      # CRUD + ML predict on submit
│   │   ├── dashboard.py         # /dashboard/stats
│   │   └── alerts.py            # /alerts, /models/performance, /reports/export
│   ├── models/
│   │   ├── user.py              # Pydantic v2 schemas
│   │   └── transaction.py
│   ├── ml/
│   │   ├── train.py             # Trains 3 models with SMOTE, persists with joblib
│   │   ├── predict.py           # Lazy-loaded inference pipeline
│   │   ├── evaluate.py          # Loads metrics.json
│   │   └── saved_models/        # Generated artifacts (after training)
│   └── data/
│       └── generate_data.py     # 5000-row synthetic transaction CSV
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx              # Routes + ProtectedRoute
        ├── index.css            # Tailwind + custom utilities
        ├── api/
        │   ├── axiosConfig.ts   # In-memory JWT, 401 auto-logout
        │   ├── AuthContext.tsx  # useAuth() hook
        │   └── types.ts         # All API types
        ├── components/
        │   ├── Layout.tsx       # Sidebar + header chrome
        │   ├── Panel.tsx        # Panel + Kpi primitives
        │   ├── StatusBadge.tsx
        │   ├── TransactionTable.tsx
        │   ├── Dashboard.tsx
        │   ├── AlertPanel.tsx
        │   ├── ModelMetrics.tsx
        │   └── TransactionForm.tsx
        └── pages/
            ├── Login.tsx
            ├── Home.tsx
            └── Reports.tsx
```

---

## Setup

> This repository intentionally excludes `node_modules`, Python virtual environments, local databases, generated datasets, trained model artifacts, and `.env` files. These are recreated locally using the commands below.

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

python data/generate_data.py      # Step 1: synthetic dataset → data/transactions.csv
python ml/train.py                # Step 2: train 3 models → ml/saved_models/
python seed.py                    # Step 3: create demo user + seed DB

uvicorn main:app --reload --port 8000
```

API now live at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

### 3. Sign in

The seed script creates one analyst account:

```
username: analyst
password: analyst123
```

The login page has a "use demo credentials" shortcut.

---

## ML pipeline

The dataset and models are deliberately straightforward — the goal is a realistic, end-to-end pipeline an analyst can interrogate, not bleeding-edge accuracy.

### Synthetic data (`data/generate_data.py`)

5,000 rows, ~3% fraud rate. Features:

| Feature | Type | Notes |
|---|---|---|
| `amount` | float | Right-skewed; fraud biased toward high amounts |
| `hour_of_day` | int | 0–23; fraud concentrates at night |
| `is_weekend` | bool | Slight weekend bias for fraud |
| `merchant_category` | categorical | 8 categories; `digital_goods` and `gambling` over-represented in fraud |
| `device_type` | categorical | `mobile`, `desktop`, `tablet`, `unknown` |
| `location_risk_score` | float 0–1 | Higher for fraud |
| `transaction_velocity` | int | Recent transactions by user; high velocity → fraud signal |
| `distance_from_home` | float (km) | Large distances correlate with fraud |
| `is_fraud` | 0/1 | Label |

### Models (`ml/train.py`)

Three models, each chosen for a specific reason:

- **Logistic Regression** — interpretable baseline. Coefficients map directly to feature weights, so it's the model an analyst can reason about by hand. Used as the lower bound: any deeper model that can't beat LR isn't earning its complexity.
- **Random Forest** — primary scoring model. Handles non-linear feature interactions (e.g., "high amount AND late at night AND distant location") natively, exposes per-feature importance for attribution, and is robust to the kind of noisy synthetic features we have.
- **Isolation Forest** — unsupervised anomaly detector. Trained with no labels, it catches outliers the supervised models miss because the fraud type was rare or absent in training. Acts as a second-opinion safety net.

Pipeline:

1. `StandardScaler` on numerics, one-hot on categoricals.
2. Train/test split (80/20, stratified on `is_fraud`).
3. **SMOTE applied to the training split only** — never to test, to avoid optimistic metrics.
4. Fit each model, evaluate on the untouched test set.
5. Persist scaler, models, feature names, and a `metrics.json` with precision / recall / F1 / ROC-AUC and a confusion matrix per model.

Random Forest is the production scorer — it's what `/transactions` POST calls. The other two are visible on the **Models** page so analysts can compare and sanity-check.

### Inference (`ml/predict.py`)

`predict_transaction(payload)` returns:

```json
{
  "is_fraud": true,
  "risk_score": 0.87,
  "model_used": "random_forest",
  "flagged_features": [
    { "name": "location_risk_score", "value": 0.91, "importance": 0.21 },
    { "name": "amount",              "value": 1899.5, "importance": 0.18 },
    { "name": "hour_of_day",         "value": 3,     "importance": 0.12 }
  ]
}
```

`flagged_features` are the top-3 RF feature importances — the model's own answer to "why did you flag this?".

---

## API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | — | Create analyst account, returns JWT |
| POST | `/auth/login` | — | Exchange credentials for JWT |
| GET | `/dashboard/stats` | ✓ | KPIs, 7-day volume, type mix, top fraud merchants, recent activity |
| POST | `/transactions` | ✓ | Submit a transaction → triggers ML scoring → persists with status |
| GET | `/transactions` | ✓ | Paginated list, optional `status` filter |
| GET | `/transactions/{id}` | ✓ | Single transaction detail |
| PATCH | `/transactions/{id}/review` | ✓ | Analyst decision (`approve` / `reject` / `investigate`) |
| GET | `/alerts` | ✓ | Filtered alert queue |
| GET | `/alerts/{id}` | ✓ | Single alert detail |
| GET | `/models/performance` | ✓ | Per-model metrics + confusion matrix + feature importances |
| GET | `/reports/export?format=csv` | ✓ | CSV export with date / status filters |

All protected routes require `Authorization: Bearer <token>`.

---

## Planned extensions

- Add a real credit-card fraud dataset for comparative experiments.
- Tune the fraud threshold using precision-recall trade-offs.
- Add SHAP-based local explanations for individual predictions.
- Add unit and integration tests for the API and ML pipeline.
- Add Docker deployment and CI checks.
- Add monitoring for data drift and model-performance changes.

## Security and data notes

- Secrets must be stored in environment variables and must not be committed.
- Generated datasets, databases, dependencies, and model artifacts are excluded from version control.
- This project is for educational and portfolio purposes and is not a certified payment-security system.

## Attribution

This project is an independently customized and extended implementation inspired by [Sentinel Fraud Detection](https://github.com/Sohankurane/Sentinel-Fraud-Ddetection) by Sohankurane. Please preserve the original repository's license requirements when redistributing code.

## Author

**Kartik Singh**

---

## Sample prediction

**Request** — `POST /transactions`

```json
{
  "user_id": "u_904112",
  "merchant_id": "m_7741",
  "merchant_category": "digital_goods",
  "amount": 1899.50,
  "device_type": "mobile",
  "location": "Lagos, NG",
  "hour_of_day": 3,
  "is_weekend": 0,
  "location_risk_score": 0.91,
  "transaction_velocity": 11,
  "distance_from_home": 320.4
}
```

**Response — 201 Created**

```json
{
  "transaction_id": 1742,
  "status": "ALERT",
  "is_fraud": true,
  "risk_score": 0.87,
  "model_used": "random_forest",
  "flagged_features": [
    { "name": "location_risk_score", "value": 0.91, "importance": 0.21 },
    { "name": "amount", "value": 1899.5, "importance": 0.18 },
    { "name": "hour_of_day", "value": 3, "importance": 0.12 }
  ],
  "created_at": "2026-05-07T03:14:08Z"
}
```

The transaction is persisted with `status="ALERT"` and immediately appears in the alert queue.

---

## Model performance

Metrics are produced by `ml/train.py` and read live by the **Models** page from `ml/saved_models/metrics.json`. After running training you'll see output like:

```
=== Logistic Regression ===
              precision    recall  f1-score   support
           0      0.99      0.96      0.98       970
           1      0.45      0.83      0.58        30
roc_auc: 0.96

=== Random Forest ===
              precision    recall  f1-score   support
           0      1.00      0.99      0.99       970
           1      0.78      0.93      0.85        30
roc_auc: 0.99

=== Isolation Forest ===
              precision    recall  f1-score   support
           0      0.98      0.97      0.97       970
           1      0.32      0.50      0.39        30
roc_auc: 0.78
```

Exact numbers vary slightly between runs because of the synthetic data seed. Random Forest is the strongest by a clear margin, which is why it's the production scorer.

---

## Analyst workflow

```
   ┌────────────────┐
   │  POST /tx      │  — incoming transaction
   └────────┬───────┘
            │
            ▼
   ┌────────────────┐
   │  ML scoring    │  — Random Forest predict_proba
   └────────┬───────┘
            │
       ┌────┴────┐
       ▼         ▼
   risk < 0.5    risk ≥ 0.5
   status=SAFE   status=ALERT  →  appears in /alerts
                                      │
                                      ▼
                              analyst opens detail
                              sees feature attribution
                                      │
                          ┌───────────┼───────────┐
                          ▼           ▼           ▼
                       approve     reject     investigate
                       APPROVED   CONFIRMED_  UNDER_
                                  FRAUD       REVIEW
```

Every transition is logged with the analyst's username, timestamp, and the new status. The audit trail is queryable from the Reports page.

---

## Design notes

- **In-memory tokens.** JWTs live in React state via `AuthContext`. There's no `localStorage` write, so a refresh logs you out — by design. For production you'd swap in an `httpOnly` cookie strategy.
- **Pydantic v2 strict validation** on every request body. Bad payloads return `422` with field-level detail.
- **TypeScript strict mode** on the frontend. No `any`. All API responses typed against `src/api/types.ts`.
- **Status mapping** — analyst decisions map to terminal statuses: `approve → APPROVED`, `reject → CONFIRMED_FRAUD`, `investigate → UNDER_REVIEW`. The original `is_fraud` prediction is preserved separately, so you can audit model agreement vs analyst decisions later.

---

## License

Demo / educational use.
