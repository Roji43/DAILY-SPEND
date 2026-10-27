import * as FileSystem from "expo-file-system/legacy";
import { BudgetFile } from "./types";

const BUDGET_FILE = `${FileSystem.documentDirectory}daily-spend-budget.json`;

const sanitizeBudget = (value: unknown): BudgetFile => {
  const file = value as BudgetFile;

  return {
    ...file,
    detected: Array.isArray(file.detected)
      ? file.detected
          .filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.amount === "number" &&
              (item.type === "debit" || item.type === "credit") &&
              typeof item.date === "string"
          )
          .map((item) => ({
            id: item.id,
            amount: item.amount,
            type: item.type,
            source: "SMS",
            date: item.date,
            status:
              item.status === "approved" || item.status === "dismissed"
                ? item.status
                : "pending",
          }))
      : [],
  };
};

export const saveBudget = async (file: BudgetFile) => {
  try {
    await FileSystem.writeAsStringAsync(
      BUDGET_FILE,
      JSON.stringify(sanitizeBudget(file), null, 2)
    );
  } catch (err) {
    console.error("Save failed:", err);
    throw err;
  }
};

export const loadBudget = async (): Promise<BudgetFile | null> => {
  try {
    const exists = await FileSystem.getInfoAsync(BUDGET_FILE);
    if (!exists.exists) return null;
    const content = await FileSystem.readAsStringAsync(BUDGET_FILE);
    return sanitizeBudget(JSON.parse(content));
  } catch (err) {
    console.error("Load failed:", err);
    return null;
  }
};

export const exportBudget = async (file: BudgetFile) => {
  try {
    const uri = await FileSystem.cacheDirectory + "daily-spend-export.json";
    await FileSystem.writeAsStringAsync(
      uri,
      JSON.stringify(sanitizeBudget(file), null, 2)
    );
    return uri;
  } catch (err) {
    console.error("Export failed:", err);
    throw err;
  }
};