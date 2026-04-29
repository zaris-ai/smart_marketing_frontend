import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const backendBaseUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8000/api"
    : process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "https://api.smart.arkaanalyzer.com/api";

if (!backendBaseUrl) {
  throw new Error("Missing API_BASE_URL or NEXT_PUBLIC_API_BASE_URL");
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Username and password are required");
        }

        const response = await fetch(`${backendBaseUrl}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            username: credentials.username,
            password: credentials.password,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Invalid username or password");
        }

        return {
          id: data.user.id,
          username: data.user.username,
          name: data.user.name || data.user.fullName || data.user.username,
          email: data.user.email || null,
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
          accessTokenExpiresIn: data.tokens.accessTokenExpiresIn,
          refreshTokenExpiresIn: data.tokens.refreshTokenExpiresIn,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.name = (user as any).name;
        token.email = (user as any).email;
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.accessTokenExpiresIn = (user as any).accessTokenExpiresIn;
        token.refreshTokenExpiresIn = (user as any).refreshTokenExpiresIn;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).username = token.username as string;
        session.user.name = (token.name as string) || session.user.name;
        session.user.email = (token.email as string) || session.user.email;
      }

      (session as any).accessToken = token.accessToken;
      (session as any).refreshToken = token.refreshToken;
      (session as any).accessTokenExpiresIn = token.accessTokenExpiresIn;
      (session as any).refreshTokenExpiresIn = token.refreshTokenExpiresIn;

      return session;
    },
  },
};

export default NextAuth(authOptions);