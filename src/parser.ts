import { Detected } from "./types";
import { newId } from "./format";
import { keyOf } from "./dates";

export const parseMessages = (smsArray: string[]): Detected[] => {
  const detected: Detected[] = [];

  for (const sms of smsArray) {
    // Skip OTPs
    if (sms.match(/\b[0-9]{4,6}\b/) && !sms.match(/amount|rupee|₹/i)) {
      continue;
    }

    const isDebit = /debited|spent|paid|withdrawn/i.test(sms);
    const isCredit = /credited|received|salary|deposited/i.test(sms);
    if (isDebit === isCredit) continue;

    const amountMatch = sms.match(/₹?\s*([0-9,]+(?:\.[0-9]{2})?)/);
    if (!amountMatch) continue;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    detected.push({
      id: newId(),
      amount,
      type: isDebit ? "debit" : "credit",
      source: "SMS",
      date: keyOf(new Date()),
      status: "pending",
    });
  }

  return detected;
};
