import { v4 as uuid } from "uuid";

export const newId = () => uuid();

export const formatRupee = (amount: number): string => {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
  const sign = amount < 0 ? "-" : "";
  return `${sign}₹${formatted}`;
};