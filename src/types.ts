export type BudgetFile = {
  income: Income[];
  expenses: Expense[];
  bills: Bill[];
  settings: {
    dailyLimit: number;
    categories: string[];
    people: string[];
  };
  detected: Detected[];
};

export type MonthData = {
  month: string;
  income: Income[];
  expenses: Expense[];
  bills: Bill[];
  detected: Detected[];
};

export type Income = {
  id: string;
  amount: number;
  date: string;
  source: string;
  notes?: string;
  month: string;
};

export type Expense = {
  id: string;
  amount: number;
  date: string;
  category: string;
  spentFor: "Us" | "Theo" | "Agu";
  notes?: string;
  month: string;
  startDate?: string;
  endDate?: string;
  spread?: boolean;
};

export type Bill = {
  id: string;
  name: string;
  amount: number;
  dueDate: number;
  month: string;
  paid: boolean;
  paidDate?: string;
};

export type Detected = {
  id: string;
  amount: number;
  type: "debit" | "credit";
  source: string;
  date: string;
  status: "pending" | "approved" | "dismissed";
};