import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api, { setAuthToken, setOnAuthError } from "../api/axiosConfig";
import { AuthResponse, User } from "../api/types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
  }, []);

  useEffect(() => {
    setOnAuthError(() => logout());
    return () => setOnAuthError(null);
  }, [logout]);

  const applyAuth = useCallback((data: AuthResponse) => {
    setUser(data.user);
    setToken(data.access_token);
    setAuthToken(data.access_token);
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      const { data } = await api.post<AuthResponse>("/auth/login", { username, password });
      applyAuth(data);
    },
    [applyAuth]
  );

  const register = useCallback(
    async (username: string, email: string, password: string): Promise<void> => {
      const { data } = await api.post<AuthResponse>("/auth/register", {
        username,
        email,
        password,
      });
      applyAuth(data);
    },
    [applyAuth]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout,
    }),
    [user, token, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
