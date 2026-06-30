// types/next-auth.d.ts
// Extends NextAuth's built-in types so TypeScript knows about our
// custom fields (id, role, status, memberNumber, firstName, lastName).
// This file fixes 11 of the 17 tsc errors in one shot.

import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id:           string;
      role:         string;
      status:       string;
      memberNumber: string;
      firstName:    string;
      lastName:     string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id:     string;
    role:   string;
    status: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id:           string;
    role:         string;
    status:       string;
    memberNumber?: string;
    firstName?:   string;
    lastName?:    string;
  }
}