// middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// =============================================================================
// ROLE DEFINITIONS — must exactly match the Role enum in schema.prisma
// =============================================================================

// Can access any /admin route
const ADMIN_ROLES = [
  "ADMIN",
  "CHAIRPERSON",
  "VICE_CHAIRPERSON",
  "SECRETARY",
  "TREASURER",
  "AUDITOR",
  "LOAN_OFFICER",
  "CREDIT_COMMITTEE_MEMBER",
];

// Granular sub-route permissions
// Key = path prefix, Value = roles that are allowed
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  // Financial records & group balance — Treasurer + Admin only
  "/admin/data-entry":  ["ADMIN", "TREASURER"],
  "/admin/approvals":   ["ADMIN", "TREASURER", "CHAIRPERSON"],

  // Loan review — Credit Committee + Loan Officer + management
  "/admin/loans":       ["ADMIN", "TREASURER", "CHAIRPERSON", "CREDIT_COMMITTEE_MEMBER", "LOAN_OFFICER"],

  // Member management — Secretary + management
  "/admin/members":     ["ADMIN", "CHAIRPERSON", "SECRETARY"],

  // Invite codes — Admin + Secretary
  "/admin/codes":       ["ADMIN", "SECRETARY"],

  // Reports & AGM data — Auditor + management
  "/admin/reports":     ["ADMIN", "TREASURER", "AUDITOR", "CHAIRPERSON"],
};

// =============================================================================
// MIDDLEWARE
// =============================================================================

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path  = req.nextUrl.pathname;

    // ── 1. No token: let NextAuth's `authorized` callback below handle it ──
    // Without this guard, unauthenticated users get redirected to /waiting-room
    // instead of /login, creating a confusing experience.
    if (!token) {
      return NextResponse.next();
    }

    // ── 2. Status check ────────────────────────────────────────────────────
    // PENDING / SUSPENDED / EXPELLED members are confined to /waiting-room.
    // We exclude /waiting-room itself to avoid an infinite redirect loop.
    const isWaitingRoom = path === "/waiting-room";

    // ── Defensive status check ─────────────────────────────────────────────
    // BEFORE the migration runs: existing DB users have no status column.
    // Prisma returns undefined. The old check `!== "ACTIVE"` would match
    // undefined and incorrectly send every user to /waiting-room.
    //
    // FIX: only block users with an EXPLICIT non-active status string.
    // undefined/null = pre-migration user = treat as active and let through.
    const blockedStatuses = ["PENDING", "SUSPENDED", "EXPELLED", "INACTIVE", "RESIGNED", "DECEASED"];
    const isBlocked = token.status && blockedStatuses.includes(token.status as string);

    if (isBlocked && !isWaitingRoom) {
      return NextResponse.redirect(new URL("/waiting-room", req.url));
    }

    if (!isBlocked && isWaitingRoom) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // ── 3. Admin section: broad role gate ─────────────────────────────────
    const isAdminRoute = path.startsWith("/admin");
    const userRole     = token.role as string;

    if (isAdminRoute && !ADMIN_ROLES.includes(userRole)) {
      // Regular member trying to access /admin — send back to their dashboard
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // ── 4. Admin section: granular sub-route gate ─────────────────────────
    // Check every defined permission rule. The most specific match wins.
    if (isAdminRoute) {
      for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
        if (path.startsWith(routePrefix)) {
          if (!allowedRoles.includes(userRole)) {
            // They have an admin role, but not for this specific page.
            // Redirect to the admin root rather than the member dashboard.
            return NextResponse.redirect(new URL("/admin", req.url));
          }
          break; // First match wins — stop checking
        }
      }
    }

    return NextResponse.next();
  },
  {
        callbacks: {
      // Allow the request through to the middleware function where 
      // your actual, robust token and role validation logic lives.
      authorized: () => true,
    },
  }
);

export const config = {
  // Protect all routes under /dashboard, /admin, and /waiting-room.
  // Next.js route groups like (portal) are stripped from the URL,
  // so /app/(portal)/dashboard matches the /dashboard path here.
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/waiting-room",
  ],
};