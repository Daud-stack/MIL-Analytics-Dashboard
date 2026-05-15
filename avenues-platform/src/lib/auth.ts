import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(256),
});

/**
 * NextAuth configuration for Avenues Clinic Intelligence Platform
 * Credentials provider with bcrypt validation against Postgres
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = credentialsSchema.safeParse(credentials);
        if (!parsedCredentials.success) {
          return null;
        }

        const email = parsedCredentials.data.email.toLowerCase();
        const password = parsedCredentials.data.password;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { org: true },
        });

        if (!user || !user.password) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          role: user.role as "ADMIN" | "ANALYST" | "VIEWER",
          orgId: user.orgId || undefined,
          orgName: user.org?.name || undefined,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },

  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as AuthUser).role || "VIEWER";
        token.orgId = (user as AuthUser).orgId;
        token.orgName = (user as AuthUser).orgName;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as "ADMIN" | "ANALYST" | "VIEWER";
        session.user.orgId = token.orgId as string | undefined;
        session.user.orgName = token.orgName as string | undefined;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  events: {
    async signIn({ user }) {
      console.log(`[Auth] User signed in: ${user.email}`);
    },
    async signOut() {
      console.log("[Auth] User signed out");
    },
  },

  debug: process.env.NODE_ENV === "development",
};

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
  orgId?: string;
  orgName?: string;
}

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name?: string;
    role: "ADMIN" | "ANALYST" | "VIEWER";
    orgId?: string;
    orgName?: string;
  }

  interface Session {
    user: User;
  }
}

declare module "next-auth" {
  interface JWT {
    id: string;
    email: string;
    name?: string;
    role: "ADMIN" | "ANALYST" | "VIEWER";
    orgId?: string;
    orgName?: string;
  }
}
