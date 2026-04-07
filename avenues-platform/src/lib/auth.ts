import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// TODO: Import prisma client once database is set up
// import { PrismaAdapter } from "@auth/prisma-adapter";
// import prisma from "@/lib/prisma";

/**
 * NextAuth configuration for Avenues Clinic Intelligence Platform
 * Currently uses Credentials provider for email/password authentication
 * Database integration will be added when Prisma is fully configured
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    Credentials({
      async authorize(credentials) {
        // TODO: Implement database validation with bcrypt
        // This is a placeholder implementation for credentials validation
        // In production, validate against Prisma user model with password hashing

        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        // TODO: Query database like this:
        // const user = await prisma.user.findUnique({
        //   where: { email: credentials.email as string },
        // });
        //
        // if (!user) {
        //   throw new Error("User not found");
        // }
        //
        // const passwordMatch = await bcrypt.compare(
        //   credentials.password as string,
        //   user.password || ""
        // );
        //
        // if (!passwordMatch) {
        //   throw new Error("Invalid password");
        // }
        //
        // return {
        //   id: user.id,
        //   email: user.email,
        //   name: user.name,
        //   role: user.role,
        // };

        // Placeholder credentials for development
        if (
          credentials.email === "admin@avenues.clinic" &&
          credentials.password === "admin"
        ) {
          return {
            id: "1",
            email: "admin@avenues.clinic",
            name: "Admin User",
            role: "ADMIN",
          };
        }

        throw new Error("Invalid credentials");
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },

  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role || "VIEWER";
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as "ADMIN" | "ANALYST" | "VIEWER";
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  events: {
    async signIn({ user }) {
      // TODO: Add logging for sign in events
      console.log(`User signed in: ${user.email}`);
    },

    async signOut() {
      // TODO: Add logging for sign out events
      console.log("User signed out");
    },
  },

  debug: process.env.NODE_ENV === "development",
};

// Type augmentation for next-auth
declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name?: string;
    role: "ADMIN" | "ANALYST" | "VIEWER";
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
  }
}
