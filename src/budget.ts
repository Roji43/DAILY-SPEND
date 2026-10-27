import { BudgetFile, MonthData, Expense } from "./types";
import { daysInMonth, monthOf } from "./dates";

export const monthReport = (file: BudgetFile, monthStr: string) => {
  const monthExpenses = file.expenses.filter((e) => e.month === monthStr);
  const monthIncome = file.income.filter((i) => i.month === monthStr);
  const monthBills = file.bills.filter((b) => b.month === monthStr);

  const totalIncome = monthIncome.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalBills = monthBills.reduce((sum, b) => sum + b.amount, 0);

  const [year, month] = monthStr.split("-");
  const days = daysInMonth(parseInt(year), parseInt(month));
  const dailyAllocation = totalIncome / days;

  return {
    totalIncome,
    totalExpenses,
    totalBills,
    dailyAllocation,
    remaining: totalIncome - totalExpenses - totalBills,
    days,
  };
};

export const expenseAllocation = (
  file: BudgetFile,
  monthStr: string,
  dayStr: string
) => {
  const dayExpenses = file.expenses.filter(
    (e) => e.date === dayStr || (e.spread && e.startDate && e.endDate)
  );
  return dayExpenses.reduce((sum, e) => sum + e.amount, 0);
};