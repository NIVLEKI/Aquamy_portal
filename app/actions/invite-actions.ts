"use server";

import prisma from "../../lib/prisma";
import { revalidatePath } from "next/cache";



// Function to generate a random 6-character code
function generateRandomCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "AQ-";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createInviteCode() {
  const newCode = generateRandomCode();
  
  await prisma.inviteCode.create({
    data: {
      code: newCode,
      isUsed: false,
    },
  });

  revalidatePath("/admin/codes"); // Refresh the list automatically
}

export async function getInviteCodes() {
  return await prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { usedBy: true }
  });
}