import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

// Token is stored in module-scope memory (not localStorage) per spec.
let inMemoryToken: string | null = null;
let onAuthErrorHandler: (() => void) | null = null;

export const setAuthToken = (token: string | null): void => {
  inMemoryToken = token;
};

export const getAuthToken = (): string | null => inMemoryToken;

export const setOnAuthError = (handler: (() => void) | null): void => {
  onAuthErrorHandler = handler;
};

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (inMemoryToken) {
    config.headers.set("Authorization", `Bearer ${inMemoryToken}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only treat 401 as "session expired" when we already had a token.
    // A 401 on the login endpoint (bad password) should never log out a
    // user who is already authenticated in another tab or just before login.
    if (
      error?.response?.status === 401 &&
      inMemoryToken !== null &&
      onAuthErrorHandler
    ) {
      onAuthErrorHandler();
    }
    return Promise.reject(error);
  }
);

export default api;