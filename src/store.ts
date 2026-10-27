import { BudgetFile, MonthData, Expense, Income, Bill, Detected } from "./types";
import { newId } from "./format";
import { monthOf } from "./dates";

export const emptyFile = (): BudgetFile => ({
  income: [],
  expenses: [],
  bills: [],
  settings: {
    dailyLimit: 1000,
    categories: ["Food", "Transport", "Shopping", "Utilities", "Other"],
    people: ["Us", "Theo", "Agu"],
  },
  detected: [],
});

export const getMonth = (file: BudgetFile, monthStr: string): MonthData => {
  return {
    month: monthStr,
    income: file.income.filter((i) => i.month === monthStr),
    expenses: file.expenses.filter((e) => e.month === monthStr),
    bills: file.bills.filter((b) => b.month === monthStr),
    detected: file.detected.filter((d) => d.date.startsWith(monthStr)),
  };
};

export const addExpense = (file: BudgetFile, expense: Expense): BudgetFile => {
  return {
    ...file,
    expenses: [...file.expenses, { ...expense, id: newId(), month: monthOf(new Date()) }],
  };
};

export const addIncome = (file: BudgetFile, income: Income): BudgetFile => {
  return {
    ...file,
    income: [...file.income, { ...income, id: newId(), month: monthOf(new Date()) }],
  };
};

export const addBill = (file: BudgetFile, bill: Bill): BudgetFile => {
  return {
    ...file,
    bills: [...file.bills, { ...bill, id: newId() }],
  };
};

export const mergeMessages = (
  file: BudgetFile,
  messages: Detected[]
): BudgetFile => {
  const existingIds = new Set(file.detected.map((d) => d.id));
  const newMessages = messages.filter((m) => !existingIds.has(m.id));
  return {
    ...file,
    detected: [...file.detected, ...newMessages],
  };
};

export const approveDetected = (
  file: BudgetFile,
  id: string
): BudgetFile => {
  const detected = file.detected.find((d) => d.id === id);
  if (!detected) return file;

  const newExpense: Expense = {
    id: newId(),
    amount: detected.amount,
    date: detected.date,
    category: "Auto-detected",
    spentFor: "Us",
    month: monthOf(new Date(detected.date)),
  };

  return {
    ...file,
    expenses: [...file.expenses, newExpense],
    detected: file.detected.map((d) =>
      d.id === id ? { ...d, status: "approved" } : d
    ),
  };
};

export const dismissDetected = (file: BudgetFile, id: string): BudgetFile => {
  return {
    ...file,
    detected: file.detected.map((d) =>
      d.id === id ? { ...d, status: "dismissed" } : d
    ),
  };
};