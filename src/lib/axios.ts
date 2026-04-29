import axios from "axios";
import { getSession, signOut } from "next-auth/react";

const rawBaseURL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8000/api"
    : process.env.NEXT_PUBLIC_API_BASE_URL;

const baseURL = rawBaseURL?.replace(/\/+$/, "");

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.request.use(
  async (config) => {
    if (typeof window !== "undefined") {
      const session = await getSession();
      const accessToken = session?.accessToken;

      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      await signOut({
        callbackUrl: "/auth/login",
        redirect: true,
      });
    }

    return Promise.reject(error);
  }
);

export default api;