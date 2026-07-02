// lib/email.ts
// Resend client + all transactional email functions for AQUAMY.
// All emails use HTTPS links from NEXT_PUBLIC_APP_URL.
// Never expose internal errors — catch and log only.

import { Resend } from "resend";
import crypto from "crypto";
import prisma from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY!);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FROM    = "AQUAMY <onboarding@resend.dev>"; // change to your verified domain

// =============================================================================
// TOKEN HELPERS
// =============================================================================

// Generate a cryptographically secure URL-safe token
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// =============================================================================
// EMAIL VERIFICATION
// =============================================================================

export async function sendVerificationEmail(userId: string, email: string, name: string) {
  try {
    // Invalidate any existing unused tokens for this user
    await prisma.emailVerificationToken.updateMany({
      where:  { userId, usedAt: null },
      data:   { usedAt: new Date() },
    });

    const token     = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerificationToken.create({
      data: { userId, token, expiresAt },
    });

    const verifyUrl = `${APP_URL}/api/verify-email?token=${token}`;

    await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: "Verify your email — AQUAMY",
      html:    verificationEmailHtml({ name, verifyUrl }),
    });
  } catch (err) {
    console.error("[sendVerificationEmail]", err);
  }
}

// =============================================================================
// REGISTRATION CONFIRMATION
// =============================================================================

export async function sendRegistrationConfirmationEmail(email: string, name: string) {
  try {
    await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: "Application received — AQUAMY",
      html:    registrationConfirmationHtml({ name }),
    });
  } catch (err) {
    console.error("[sendRegistrationConfirmationEmail]", err);
  }
}

// =============================================================================
// APPROVAL EMAIL
// =============================================================================

export async function sendApprovalEmail(email: string, name: string) {
  try {
    const loginUrl = `${APP_URL}/login`;

    await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: "Welcome to AQUAMY — Your membership has been approved",
      html:    approvalEmailHtml({ name, loginUrl }),
    });
  } catch (err) {
    console.error("[sendApprovalEmail]", err);
  }
}

// =============================================================================
// REJECTION EMAIL
// =============================================================================

export async function sendRejectionEmail(email: string, name: string) {
  try {
    await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: "Your AQUAMY application — Update",
      html:    rejectionEmailHtml({ name }),
    });
  } catch (err) {
    console.error("[sendRejectionEmail]", err);
  }
}

// =============================================================================
// PASSWORD RESET
// =============================================================================

export async function sendPasswordResetEmail(userId: string, email: string, name: string) {
  try {
    // Invalidate existing unused reset tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data:  { usedAt: new Date() },
    });

    const token     = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId, token, expiresAt },
    });

    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: "Reset your AQUAMY password",
      html:    passwordResetHtml({ name, resetUrl }),
    });
  } catch (err) {
    console.error("[sendPasswordResetEmail]", err);
  }
}

// =============================================================================
// EMAIL TEMPLATES
// Each template returns a self-contained HTML string.
// Inline styles only — email clients strip <style> blocks.
// =============================================================================

const BASE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #F7F5F0;
  margin: 0; padding: 0;
`;
const CARD = `
  max-width: 560px; margin: 40px auto; background: #ffffff;
  border-radius: 16px; overflow: hidden;
  border: 1px solid #e7e5e4; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
`;
const HEADER = `
  background: #1C4A2E; padding: 28px 32px; text-align: center;
`;
const BODY = `padding: 32px;`;
const H1 = `
  color: #ffffff; font-size: 20px; font-weight: 800;
  margin: 8px 0 0; letter-spacing: -0.3px;
`;
const LOGO_TEXT = `
  color: rgba(255,255,255,0.6); font-size: 11px;
  font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;
`;
const P = `color: #44403c; font-size: 15px; line-height: 1.7; margin: 0 0 16px;`;
const BTN = `
  display: inline-block; background: #1C4A2E; color: #ffffff !important;
  font-size: 14px; font-weight: 700; padding: 14px 28px;
  border-radius: 10px; text-decoration: none; margin: 8px 0 24px;
`;
const SMALL = `color: #a8a29e; font-size: 12px; line-height: 1.6;`;
const FOOTER = `
  padding: 20px 32px; background: #f8f7f4;
  border-top: 1px solid #e7e5e4; text-align: center;
`;
const FOOTER_TEXT = `color: #a8a29e; font-size: 11px; margin: 0;`;

function wrap(content: string): string {
  return `<!DOCTYPE html><html><body style="${BASE}">
    <div style="${CARD}">${content}
      <div style="${FOOTER}">
        <p style="${FOOTER_TEXT}">
          © ${new Date().getFullYear()} Agricultural and Aquatic Muirungi Youth Self-Help Group<br/>
          Built by <a href="https://nivleksolutions.co.ke" style="color:#1C4A2E;">Nivlek Solutions</a>
        </p>
      </div>
    </div>
  </body></html>`;
}

function verificationEmailHtml({ name, verifyUrl }: { name: string; verifyUrl: string }) {
  return wrap(`
    <div style="${HEADER}">
      <p style="${LOGO_TEXT}">AQUAMY</p>
      <h1 style="${H1}">Verify your email</h1>
    </div>
    <div style="${BODY}">
      <p style="${P}">Hi ${name},</p>
      <p style="${P}">
        Thank you for registering with AQUAMY. Please verify your email address
        by clicking the button below. This link expires in 24 hours.
      </p>
      <div style="text-align:center;">
        <a href="${verifyUrl}" style="${BTN}">Verify My Email</a>
      </div>
      <p style="${SMALL}">
        If you did not register for AQUAMY, please ignore this email.<br/>
        This link can only be used once.
      </p>
      <p style="${SMALL}">
        Or copy this link into your browser:<br/>
        <span style="color:#1C4A2E;">${verifyUrl}</span>
      </p>
    </div>
  `);
}

function registrationConfirmationHtml({ name }: { name: string }) {
  return wrap(`
    <div style="${HEADER}">
      <p style="${LOGO_TEXT}">AQUAMY</p>
      <h1 style="${H1}">Application received</h1>
    </div>
    <div style="${BODY}">
      <p style="${P}">Hi ${name},</p>
      <p style="${P}">
        Your registration application has been received and is now in the
        waiting room pending review by the AQUAMY management committee.
      </p>
      <p style="${P}">
        <strong>What happens next:</strong><br/>
        A committee member will review your application. You will receive
        an email once a decision has been made. This may take a few days
        depending on the committee's schedule.
      </p>
      <p style="${P}">
        In the meantime, please verify your email address using the
        separate verification email we have sent you.
      </p>
      <p style="${SMALL}">
        If you have any questions, please contact the AQUAMY Secretary directly.
      </p>
    </div>
  `);
}

function approvalEmailHtml({ name, loginUrl }: { name: string; loginUrl: string }) {
  return wrap(`
    <div style="${HEADER}">
      <p style="${LOGO_TEXT}">AQUAMY</p>
      <h1 style="${H1}">Welcome to AQUAMY 🎉</h1>
    </div>
    <div style="${BODY}">
      <p style="${P}">Hi ${name},</p>
      <p style="${P}">
        We are pleased to inform you that your AQUAMY membership application
        has been <strong>approved</strong> by the management committee.
      </p>
      <p style="${P}">
        Your account is now active. You may log in to the member portal
        to view your contributions, apply for loans, and manage your account.
      </p>
      <div style="text-align:center;">
        <a href="${loginUrl}" style="${BTN}">Log In to Member Portal</a>
      </div>
      <p style="${SMALL}">
        If you have any questions about your membership or the portal,
        please contact the AQUAMY Secretary.
      </p>
    </div>
  `);
}

function rejectionEmailHtml({ name }: { name: string }) {
  return wrap(`
    <div style="${HEADER}">
      <p style="${LOGO_TEXT}">AQUAMY</p>
      <h1 style="${H1}">Application update</h1>
    </div>
    <div style="${BODY}">
      <p style="${P}">Hi ${name},</p>
      <p style="${P}">
        Thank you for your interest in joining AQUAMY. After careful review,
        the management committee has decided that your application will not
        be progressed at this time.
      </p>
      <p style="${P}">
        Your account remains inactive. If you believe this decision was made
        in error, or if you would like further information, please contact
        the AQUAMY Secretary directly.
      </p>
      <p style="${SMALL}">
        We appreciate your interest in AQUAMY and wish you well.
      </p>
    </div>
  `);
}

function passwordResetHtml({ name, resetUrl }: { name: string; resetUrl: string }) {
  return wrap(`
    <div style="${HEADER}">
      <p style="${LOGO_TEXT}">AQUAMY</p>
      <h1 style="${H1}">Reset your password</h1>
    </div>
    <div style="${BODY}">
      <p style="${P}">Hi ${name},</p>
      <p style="${P}">
        We received a request to reset the password for your AQUAMY account.
        Click the button below to set a new password. This link expires in
        <strong>1 hour</strong>.
      </p>
      <div style="text-align:center;">
        <a href="${resetUrl}" style="${BTN}">Reset My Password</a>
      </div>
      <p style="${SMALL}">
        If you did not request a password reset, please ignore this email.
        Your password will not be changed.<br/>
        This link can only be used once.
      </p>
      <p style="${SMALL}">
        Or copy this link into your browser:<br/>
        <span style="color:#1C4A2E;">${resetUrl}</span>
      </p>
    </div>
  `);
}