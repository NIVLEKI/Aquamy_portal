// app/api/auth/[...nextauth]/route.ts — v2
// JWT is now minimal: only stores id + role.
// All other fields (name, memberNumber, status) are fetched fresh
// in the session callback using the stored id — avoids 431 errors.

import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages:   { signIn: "/login" },

  callbacks: {
    // ── JWT: runs on sign-in and every token refresh ──────────────────────
    // Keep this MINIMAL — only store what cannot be looked up later.
    // Every extra field increases the cookie size and risks 431.
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id;
        token.role = user.role;
        // status stored so middleware can check it without a DB call
        token.status = user.status;
      }
      return token;
    },

    // ── Session: runs on every getServerSession() call ────────────────────
    // We do ONE lightweight DB lookup here to get fresh profile data.
    // This means name/memberNumber always reflects the latest DB values,
    // even if the user updates their profile without re-logging in.
    async session({ session, token }) {
      if (session.user && token.id) {
        // Lightweight select — only the fields the UI needs
        const dbUser = await prisma.user.findUnique({
          where:  { id: token.id as string },
          select: {
            id:           true,
            name:         true,
            firstName:    true,
            lastName:     true,
            email:        true,
            memberNumber: true,
            role:         true,
            status:       true,
          },
        }).catch(() => null);

        if (dbUser) {
          session.user.id           = dbUser.id;
          session.user.name         = dbUser.firstName?.trim()
            ? `${dbUser.firstName} ${dbUser.lastName}`
            : dbUser.name;
          session.user.email        = dbUser.email ?? session.user.email;
          session.user.memberNumber = dbUser.memberNumber;
          session.user.role         = dbUser.role;
          session.user.status       = dbUser.status;
          session.user.firstName    = dbUser.firstName ?? "";
          session.user.lastName     = dbUser.lastName  ?? "";
        } else {
          // Fallback to token values if DB lookup fails
          session.user.id     = token.id   as string;
          session.user.role   = token.role   as string;
          session.user.status = token.status as string;
        }
      }
      return session;
    },
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter your email and password.");
        }

        const user = await prisma.user.findUnique({
          where:  { email: credentials.email },
          select: {
            id:       true,
            email:    true,
            password: true,
            role:     true,
            status:   true,
            isActive: true,
          },
        });

        if (!user) throw new Error("No account found with this email.");

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) throw new Error("Incorrect password. Please try again.");

        // Status checks — covers both old (isActive) and new (status) fields
        const blocked = ["PENDING", "SUSPENDED", "EXPELLED", "INACTIVE"];
        const isPending   = blocked.includes(user.status) || user.isActive === false;
        const isSuspended = user.status === "SUSPENDED" || user.status === "EXPELLED";

        if (isPending && !isSuspended)
          throw new Error("Your account is pending admin approval.");
        if (isSuspended)
          throw new Error("Your account has been suspended. Contact the Secretary.");

        // Return ONLY id and role — everything else is fetched in session callback
        return {
          id:     user.id,
          email:  user.email ?? "",
          role:   user.role,
          status: user.status ?? "ACTIVE",
        };
      },
    }),
  ],
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };