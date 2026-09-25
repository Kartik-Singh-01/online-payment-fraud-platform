# FraudShield — Online Payment Fraud Detection Platform

FraudShield is a full-stack machine-learning platform for detecting potentially fraudulent online payment transactions. It provides real-time fraud predictions, risk scores, transaction persistence, automated alert statuses, and analyst review workflows.

## Features

- Real-time transaction fraud prediction using FastAPI
- Logistic Regression, Random Forest, and Isolation Forest models
- Train-only SMOTE for handling imbalanced fraud data
- Precision, recall, F1-score, ROC-AUC, and confusion-matrix evaluation
- Random Forest-based fraud risk scoring
- Approximate feature-importance explanations
- JWT-based authentication with password hashing
- SQLite persistence for users and transactions
- Fraud alert filtering and analyst review actions
- React and TypeScript dashboard
- CSV transaction report export
- Model-performance reporting through the dashboard

## Technology Stack

### Backend

- Python
- FastAPI
- Pydantic
- Scikit-learn
- Pandas
- NumPy
- Imbalanced-learn
- Joblib
- SQLite
- JWT
- Passlib and Bcrypt

### Frontend

- React
- TypeScript
- Axios
- Vite

## Project Architecture

```text
online-payment-fraud-platform/
│
├── backend/
│   ├── main.py
│   ├── auth.py
│   ├── database.py
│   ├── seed.py
│   ├── routes/
│   ├── models/
│   ├── ml/
│   └── data/
│
└── frontend/
    └── src/
Machine-Learning Workflow
Transaction dataset
        ↓
Feature preparation
        ↓
Train-test split
        ↓
Feature scaling
        ↓
SMOTE applied only to training data
        ↓
Model training
        ↓
Model evaluation
        ↓
Saved model artifacts
        ↓
Real-time prediction through FastAPI

The system uses the following transaction features:

Transaction amount
Hour of the day
Weekend indicator
Merchant category
Device type
Location risk score
Transaction velocity
Distance from home

The target variable is is_fraud:

0 — Legitimate transaction
1 — Fraudulent transaction
Machine-Learning Models
Logistic Regression

Used as an interpretable baseline model.

Random Forest

Used as the primary prediction model because it can learn nonlinear relationships and interactions between transaction features.

Isolation Forest

Used as an unsupervised anomaly-detection model to identify unusual transactions.

Important API Endpoints
Method	Endpoint	Description
POST	/auth/register	Register a new user
POST	/auth/login	Authenticate a user and receive a JWT
POST	/transactions	Predict and save a transaction
GET	/transactions	Retrieve transactions
GET	/transactions/{id}	Retrieve one transaction
PATCH	/transactions/{id}/review	Update analyst review status
GET	/dashboard/stats	Retrieve dashboard statistics
GET	/alerts	Retrieve suspicious transactions
GET	/models/performance	Retrieve model metrics
GET	/reports/export?format=csv	Export transactions as CSV

Interactive API documentation is available through FastAPI Swagger UI after starting the backend:

http://localhost:8000/docs
Backend Setup

Open PowerShell and navigate to the backend folder:

cd "C:\Users\hp\Downloads\Sentinel-Fraud-detection-main\Sentinel-Fraud-detection-main\backend"

Create and activate a virtual environment:

python -m venv venv
venv\Scripts\Activate.ps1

Install dependencies:

python -m pip install -r requirements.txt

Generate the dataset:

python data/generate_data.py

Train and save the machine-learning models:

python ml/train.py

Seed the database:

python seed.py

Start the FastAPI server:

uvicorn main:app --reload --port 8000

The backend will be available at:

http://localhost:8000
Frontend Setup

Open a second terminal and navigate to the frontend folder:

cd "C:\Users\hp\Downloads\Sentinel-Fraud-detection-main\Sentinel-Fraud-detection-main\frontend"

Install frontend dependencies:

npm install

Start the frontend:

npm run dev

The frontend will normally be available at:

http://localhost:5173
Prediction Flow
User submits transaction
        ↓
React sends request to FastAPI
        ↓
JWT authentication is checked
        ↓
Pydantic validates the input
        ↓
Transaction features are prepared
        ↓
Saved Random Forest model generates a risk score
        ↓
Transaction is classified as fraud or legitimate
        ↓
Result is stored in SQLite
        ↓
Prediction is displayed on the dashboard
Project Limitations
The project currently uses a synthetic dataset.
SQLite is suitable for development and demonstration but not large-scale production workloads.
The current risk threshold is fixed at 0.5.
Feature explanations are based on approximate Random Forest feature-importance calculations.
The project does not currently integrate with a real payment gateway.
Advanced model monitoring and automatic retraining are not included.
JWT state is stored in memory on the frontend, so refreshing the browser may require logging in again.
Future Improvements
Use anonymized real-world transaction data.
Add PostgreSQL for production persistence.
Add SHAP-based model explanations.
Tune the decision threshold according to fraud-prevention business costs.
Add model-drift monitoring and automatic retraining.
Add email, SMS, or webhook alerts.
Add rate limiting and audit logging.
Add automated backend and frontend tests.
Add Docker and CI/CD deployment support.
Learning Outcomes

This project demonstrates practical experience with:

Machine-learning classification
Imbalanced-data handling
Model evaluation
REST API development
FastAPI and Pydantic
JWT authentication
SQLite persistence
React and TypeScript
Frontend-backend integration
Fraud-risk analysis
Analyst review workflows
