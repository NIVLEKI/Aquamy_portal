// app/actions/mpesa-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// =============================================================================
// DARAJA API HELPERS
// =============================================================================

async function getDarajaToken(): Promise<string> {
  const key    = process.env.MPESA_CONSUMER_KEY!;
  const secret = process.env.MPESA_CONSUMER_SECRET!;
  const auth   = Buffer.from(`${key}:${secret}`).toString("base64");

  const res = await fetch(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    { headers: { Authorization: `Basic ${auth}` } }
  );
  if (!res.ok) throw new Error("Failed to get Daraja access token");
  const data = await res.json();
  return data.access_token;
}

function getDarajaPassword(): { password: string; timestamp: string } {
  const shortcode = process.env.MPESA_SHORTCODE!;
  const passkey   = process.env.MPESA_PASSKEY!;
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
  const password  = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
  return { password, timestamp };
}

// Shared phone normaliser — used by all functions below
function normalisePhone(rawPhone: string): string {
  let phone = rawPhone.replace(/\s/g, "");
  if (phone.startsWith("0"))    phone = "254" + phone.slice(1);
  if (phone.startsWith("7"))    phone = "254" + phone;
  if (!phone.startsWith("254")) throw new Error("Invalid phone number format.");
  return phone;
}

// =============================================================================
// INITIATE STK PUSH  — YOUR EXISTING IMPLEMENTATION (unchanged)
// =============================================================================

export async function initiateSTKPush(formData: FormData): Promise<{ success: boolean; error?: string; checkoutRequestId?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { success: false, error: "Not authenticated" };

  const rawPhone = formData.get("phone") as string;
  const amount   = parseFloat(formData.get("amount") as string);
  const category = formData.get("category") as string;
  const loanId   = formData.get("loanId") as string | null;

  if (!rawPhone || isNaN(amount) || amount <= 0) {
    return { success: false, error: "Phone number and valid amount are required." };
  }

  let phone = rawPhone.replace(/\s/g, "");
  if (phone.startsWith("0"))   phone = "254" + phone.slice(1);
  if (phone.startsWith("7"))   phone = "254" + phone;
  if (!phone.startsWith("254")) return { success: false, error: "Invalid phone number format." };

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email }, select: { id: true },
  });
  if (!dbUser) return { success: false, error: "User not found." };

  try {
    const token                   = await getDarajaToken();
    const { password, timestamp } = getDarajaPassword();
    const shortcode               = process.env.MPESA_SHORTCODE!;
    const callbackUrl             = process.env.MPESA_CALLBACK_URL!;

    const body = {
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   "CustomerPayBillOnline",
      Amount:            Math.ceil(amount),
      PartyA:            phone,
      PartyB:            shortcode,
      PhoneNumber:       phone,
      CallBackURL:       callbackUrl,
      AccountReference:  "AQUAMY",
      TransactionDesc:   category.replace("_", " "),
    };

    const res = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      }
    );

    const data = await res.json();

    if (data.ResponseCode !== "0") {
      return { success: false, error: data.ResponseDescription ?? "STK push failed" };
    }

    const { CheckoutRequestID, MerchantRequestID } = data;

    let nextInstalmentNumber = 1;
    if (loanId) {
      const existingCount = await prisma.loanRepayment.count({
        where: { loanId: loanId }
      });
      nextInstalmentNumber = existingCount + 1;
    }

    await prisma.mpesaTransaction.create({
      data: {
        checkoutRequestId: CheckoutRequestID,
        merchantRequestId: MerchantRequestID,
        amount: Math.ceil(amount),
        phoneNumber: phone,
        status: "INITIATED",
        user: {
          connect: { id: dbUser.id }
        },
        ...(loanId ? {
          loanRepayment: {
            create: {
              loanId: loanId,
              expectedAmount: Math.ceil(amount),
              paidAmount: 0,
              status: "PENDING",
              instalmentNumber: nextInstalmentNumber,
              dueDate: new Date()
            }
          }
        } : {})
      }
    });

    return { success: true, checkoutRequestId: CheckoutRequestID };

  } catch (error) {
    console.error("[M-Pesa STK Push Error]", error);
    return { success: false, error: "An internal server error occurred while processing payment." };
  }
}

// =============================================================================
// CHECK PAYMENT STATUS  — YOUR EXISTING IMPLEMENTATION (unchanged)
// =============================================================================

export async function checkPaymentStatus(checkoutRequestId: string): Promise<{ success: boolean; status: string }> {
  try {
    const tx = await prisma.mpesaTransaction.findUnique({
      where: { checkoutRequestId },
      select: { status: true },
    });
    return { success: true, status: tx?.status || "INITIATED" };
  } catch (err) {
    console.error("[Check Payment Status Error]", err);
    return { success: false, status: "ERROR" };
  }
}

// =============================================================================
// GET RECENT TRANSACTIONS  — YOUR EXISTING IMPLEMENTATION (unchanged)
// =============================================================================

export async function getRecentTransactions(): Promise<{ success: boolean; data: any[] }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, data: [] };

    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!dbUser) return { success: false, data: [] };

    const transactions = await prisma.mpesaTransaction.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return { success: true, data: transactions };
  } catch (err) {
    console.error("[Get Recent Transactions Error]", err);
    return { success: false, data: [] };
  }
}

// =============================================================================
// INITIATE CONTRIBUTION PAYMENT  — NEW
// Links MpesaTransaction → Contribution before firing STK Push.
// The existing callback handler settles the contribution on success.
// =============================================================================

export async function initiateContributionPayment(
  contributionId: string,
  rawPhone:        string,
  amount:          number
): Promise<{ success: boolean; message: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { success: false, message: "Not authenticated." };

  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return { success: false, message: "User not found." };

  // Validate the contribution belongs to this user and is payable
  const contribution = await prisma.contribution.findUnique({
    where:  { id: contributionId },
    select: { id: true, userId: true, expectedAmount: true, paidAmount: true, status: true },
  });
  if (!contribution)
    return { success: false, message: "Contribution not found." };
  if (contribution.userId !== dbUser.id)
    return { success: false, message: "This contribution does not belong to your account." };
  if (contribution.status === "PAID")
    return { success: false, message: "This contribution is already fully paid." };

  const balance = contribution.expectedAmount - contribution.paidAmount;
  if (amount > balance + 1)
    return { success: false, message: `Amount exceeds outstanding balance of KES ${balance.toFixed(2)}.` };

  let phone: string;
  try {
    phone = normalisePhone(rawPhone);
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : "Invalid phone number." };
  }

  try {
    const token                   = await getDarajaToken();
    const { password, timestamp } = getDarajaPassword();
    const shortcode               = process.env.MPESA_SHORTCODE!;
    const callbackUrl             = process.env.MPESA_CALLBACK_URL!;

    const res = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password:          password,
          Timestamp:         timestamp,
          TransactionType:   "CustomerPayBillOnline",
          Amount:            Math.ceil(amount),
          PartyA:            phone,
          PartyB:            shortcode,
          PhoneNumber:       phone,
          CallBackURL:       callbackUrl,
          AccountReference:  "AQUAMY",
          TransactionDesc:   "Contribution Payment",
        }),
      }
    );

    const data = await res.json();
    if (data.ResponseCode !== "0")
      return { success: false, message: data.ResponseDescription ?? "STK Push failed." };

    const { CheckoutRequestID, MerchantRequestID } = data;

    // Create MpesaTransaction linked to the contribution
    // The callback handler reads mpesaTransactionId on Contribution to settle it
    const mpesaTx = await prisma.mpesaTransaction.create({
      data: {
        checkoutRequestId: CheckoutRequestID,
        merchantRequestId: MerchantRequestID,
        amount:            Math.ceil(amount),
        phoneNumber:       phone,
        status:            "INITIATED",
        user:              { connect: { id: dbUser.id } },
      },
    });

    // Link the contribution to this transaction so the callback can settle it
    await prisma.contribution.update({
      where: { id: contributionId },
      data:  { mpesaTransactionId: mpesaTx.id },
    });

    return {
      success: true,
      message: "STK Push sent! Check your phone and enter your M-Pesa PIN to complete.",
    };

  } catch (err) {
    console.error("[Contribution Payment Error]", err);
    return { success: false, message: "Payment initiation failed. Please try again." };
  }
}

// =============================================================================
// INITIATE SHARE PURCHASE  — NEW
// Creates a pending ShareTransaction, links MpesaTransaction to it,
// then fires the STK Push. Shares are credited in the callback on success.
// =============================================================================

export async function initiateSharePurchase(
  units:    number,
  rawPhone: string
): Promise<{ success: boolean; message: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { success: false, message: "Not authenticated." };

  if (!units || units < 1 || units > 1000)
    return { success: false, message: "Enter between 1 and 1000 units." };

  const dbUser = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return { success: false, message: "User not found." };

  const priceConfig = await prisma.systemConfig.findUnique({
    where: { key: "SHARE_PRICE_KES" },
  });
  const pricePerUnit = parseFloat(priceConfig?.value ?? "0");
  if (!pricePerUnit)
    return { success: false, message: "Share price not configured. Contact the Treasurer." };

  const totalAmount = units * pricePerUnit;

  let phone: string;
  try {
    phone = normalisePhone(rawPhone);
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : "Invalid phone number." };
  }

  try {
    const token                   = await getDarajaToken();
    const { password, timestamp } = getDarajaPassword();
    const shortcode               = process.env.MPESA_SHORTCODE!;
    const callbackUrl             = process.env.MPESA_CALLBACK_URL!;

    const res = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password:          password,
          Timestamp:         timestamp,
          TransactionType:   "CustomerPayBillOnline",
          Amount:            Math.ceil(totalAmount),
          PartyA:            phone,
          PartyB:            shortcode,
          PhoneNumber:       phone,
          CallBackURL:       callbackUrl,
          AccountReference:  "AQUAMY",
          TransactionDesc:   `Share Purchase ${units} units`,
        }),
      }
    );

    const data = await res.json();
    if (data.ResponseCode !== "0")
      return { success: false, message: data.ResponseDescription ?? "STK Push failed." };

    const { CheckoutRequestID, MerchantRequestID } = data;

    // Ensure share ledger exists
    const share = await prisma.share.upsert({
      where:  { userId: dbUser.id },
      create: { userId: dbUser.id, quantity: 0, totalValue: 0 },
      update: {},
    });

    // Create the MpesaTransaction
    const mpesaTx = await prisma.mpesaTransaction.create({
      data: {
        checkoutRequestId: CheckoutRequestID,
        merchantRequestId: MerchantRequestID,
        amount:            Math.ceil(totalAmount),
        phoneNumber:       phone,
        status:            "INITIATED",
        user:              { connect: { id: dbUser.id } },
      },
    });

    // Create pending ShareTransaction linked to this Mpesa record.
    // The callback will confirm and update Share.quantity + totalValue.
    await prisma.shareTransaction.create({
      data: {
        userId:             dbUser.id,
        shareId:            share.id,
        type:               "PURCHASE",
        units,
        pricePerUnit,
        totalAmount,
        notes:              `Pending — awaiting M-Pesa confirmation`,
        recordedBy:         dbUser.id,
        mpesaTransactionId: mpesaTx.id,
      },
    });

    return {
      success: true,
      message: `STK Push sent for KES ${totalAmount.toLocaleString()}. Enter your PIN to confirm purchase of ${units} share${units > 1 ? "s" : ""}.`,
    };

  } catch (err) {
    console.error("[Share Purchase Error]", err);
    return { success: false, message: "Payment initiation failed. Please try again." };
  }
}