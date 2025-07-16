import { useAuth } from "../contexts/AuthContext";
import * as SecureStore from "expo-secure-store";

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  skipAuth?: boolean;
}

export const useApi = () => {
  const { refreshTokens } = useAuth();

  const apiCall = async (endpoint: string, options: ApiOptions = {}) => {
    const { method = "GET", headers = {}, body, skipAuth = false } = options;

    const baseUrl = process.env.EXPO_PUBLIC_API_URL;
    const url = `${baseUrl}${endpoint}`;

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    // Add auth token if not skipped
    if (!skipAuth) {
      const accessToken = await SecureStore.getItemAsync("accessToken");
      if (accessToken) {
        requestHeaders.Authorization = `Bearer ${accessToken}`;
      }
    }

    // Prepare request config
    const config: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    // Make the request
    let response = await fetch(url, config);

    // If unauthorized and we have auth, try to refresh token
    if (response.status === 401 && !skipAuth) {
      const refreshed = await refreshTokens();

      if (refreshed) {
        // Retry with new token
        const newAccessToken = await SecureStore.getItemAsync("accessToken");
        if (newAccessToken) {
          requestHeaders.Authorization = `Bearer ${newAccessToken}`;
          response = await fetch(url, { ...config, headers: requestHeaders });
        }
      }
    }

    // Parse response
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  };

  return {
    get: (endpoint: string, options?: Omit<ApiOptions, "method">) =>
      apiCall(endpoint, { ...options, method: "GET" }),

    post: (
      endpoint: string,
      body?: any,
      options?: Omit<ApiOptions, "method" | "body">
    ) => apiCall(endpoint, { ...options, method: "POST", body }),

    put: (
      endpoint: string,
      body?: any,
      options?: Omit<ApiOptions, "method" | "body">
    ) => apiCall(endpoint, { ...options, method: "PUT", body }),

    patch: (
      endpoint: string,
      body?: any,
      options?: Omit<ApiOptions, "method" | "body">
    ) => apiCall(endpoint, { ...options, method: "PATCH", body }),

    delete: (endpoint: string, options?: Omit<ApiOptions, "method">) =>
      apiCall(endpoint, { ...options, method: "DELETE" }),
  };
};
