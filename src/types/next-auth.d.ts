import NextAuth from 'next-auth';
import { DefaultSession } from 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresIn?: string;
    refreshTokenExpiresIn?: string;
    user: {
      id?: string;
      username?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    username: string;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn?: string;
    refreshTokenExpiresIn?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    username?: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresIn?: string;
    refreshTokenExpiresIn?: string;
  }
}

interface Session {
  accessToken?: string;
  refreshToken?: string;
  user: {
    id?: string;
    username?: string;
  } & DefaultSession['user'];
}