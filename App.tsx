import { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./api/AuthContext";
import Layout from "./components/Layout";
import AlertPanel from "./components/AlertPanel";
import ModelMetrics from "./components/ModelMetrics";
import TransactionForm from "./components/TransactionForm";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Reports from "./pages/Reports";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
};

const NotFound = () => (
  <Layout>
    <div className="reveal flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="label-meta">[ 404 ]</span>
      <h1 className="mt-4 font-display text-5xl text-ink-50">
        Off the <em className="italic text-accent-amber">grid.</em>
      </h1>
      <p className="mt-3 max-w-sm text-sm text-ink-300">
        The route you requested does not exist on this console. Use the navigation
        sidebar to return to a known section.
      </p>
    </div>
  </Layout>
);

const App = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <ProtectedRoute>
              <Layout>
                <AlertPanel />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/models"
          element={
            <ProtectedRoute>
              <Layout>
                <ModelMetrics />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/submit"
          element={
            <ProtectedRoute>
              <Layout>
                <TransactionForm />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;
