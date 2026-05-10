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

// =============================================================================
// INITIATE STK PUSH
// Called from payments page. Returns success/error to the client.
// =============================================================================

export async function initiateSTKPush(formData: FormData): Promise<{ success: boolean; error?: string; checkoutRequestId?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { success: false, error: "Not authenticated" };

  const rawPhone = formData.get("phone") as string;
  const amount   = parseFloat(formData.get("amount") as string);
  const category = formData.get("category") as string;

  if (!rawPhone || isNaN(amount) || amount <= 0) {
    return { success: false, error: "Phone number and valid amount are required." };
  }

  // Normalise phone: 0722... → 254722... or 7XX → 2547XX
  let phone = rawPhone.replace(/\s/g, "");
  if (phone.startsWith("0"))   phone = "254" + phone.slice(1);
  if (phone.startsWith("7"))   phone = "254" + phone;
  if (!phone.startsWith("254")) return { success: false, error: "Invalid phone number format." };

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email }, select: { id: true },
  });
  if (!dbUser) return { success: false, error: "User not found." };

  try {
    const token                  = await getDarajaToken();
    const { password, timestamp } = getDarajaPassword();
    const shortcode              = process.env.MPESA_SHORTCODE!;
    const callbackUrl            = process.env.MPESA_CALLBACK_URL!;

    const body = {
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   "CustomerPayBillOnline",
      Amount:            Math.ceil(amount), // M-Pesa requires integer
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

    // Store the pending transaction — linked to user
    await prisma.mpesaTransaction.create({
      data: {
        userId:             dbUser.id,
        checkoutRequestId:  data.CheckoutRequestID,
        merchantRequestId:  data.MerchantRequestID,
        amount,
        phoneNumber:        phone,
        status:             "INITIATED",
      },
    });

    return { success: true, checkoutRequestId: data.CheckoutRequestID };

  } catch (err) {
    console.error("[M-Pesa STK Push Error]", err);
    return { success: false, error: "Payment service temporarily unavailable. Please try again." };
  }
}