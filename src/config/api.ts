// ============================================
// API Configuration - تنظیمات API
// ============================================

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { getSession, signOut } from "next-auth/react";
import { getLogoutUrl } from "@/utils/getLogoutUrl";

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8000/api"
    : (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL);

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});
console.log(process.env.NEXT_PUBLIC_API_BASE_URL)
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const publicRoutes = ["/auth/login", "/auth/signup", "/auth/refresh"];

    if (publicRoutes.some((route) => config.url?.includes(route))) {
      return config;
    }

    const session = await getSession();

    if (session?.accessToken) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isUnauthorized = error.response?.status === 401;
    const isRefreshRequest = originalRequest.url?.includes("/auth/refresh");

    if (isUnauthorized && !originalRequest._retry && !isRefreshRequest) {
      originalRequest._retry = true;

      try {
        const session = await getSession();
        const refreshToken = session?.refreshToken;

        if (!refreshToken) {
          await signOut({ callbackUrl: getLogoutUrl() });
          return Promise.reject(error);
        }

        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {
            refreshToken,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          },
        );

        const newAccessToken = refreshResponse.data?.tokens?.accessToken;
        const newRefreshToken = refreshResponse.data?.tokens?.refreshToken;

        if (!newAccessToken) {
          await signOut({ callbackUrl: getLogoutUrl() });
          return Promise.reject(error);
        }

        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        if (newRefreshToken) {
          // NextAuth session is not directly mutable from here.
          // If you want real token rotation persistence, handle it in NextAuth jwt/session callbacks.
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        await signOut({ callbackUrl: getLogoutUrl() });
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
