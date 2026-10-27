import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { BudgetFile, MonthData, Expense, Income, Bill, Detected } from "./types";
import { monthOf } from "./dates";
import {
  emptyFile,
  getMonth,
  addExpense,
  addIncome,
  addBill,
  mergeMessages,
  approveDetected,
  dismissDetected,
} from "./store";
import { loadBudget, saveBudget } from "./storage";

type BudgetContextType = {
  file: BudgetFile;
  month: MonthData;
  loading: boolean;
  saveData: () => Promise<void>;
  addExpenseToMonth: (expense: Expense) => void;
  addIncomeToMonth: (income: Income) => void;
  addBillToMonth: (bill: Bill) => void;
  updateMonth: (m: MonthData) => void;
  mergeNewMessages: (messages: Detected[]) => Promise<void>;
  approveMessage: (id: string) => Promise<void>;
  dismissMessage: (id: string) => Promise<void>;
};

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

export const BudgetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [file, setFile] = useState<BudgetFile>(emptyFile());
  const fileRef = useRef(file);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const [month, setMonth] = useState<MonthData>(getMonth(emptyFile(), monthOf(new Date())));
  const [loading, setLoading] = useState(true);

  const updateFile = useCallback((updated: BudgetFile) => {
    fileRef.current = updated;
    setFile(updated);
  }, []);

  const persistFile = useCallback((updated: BudgetFile) => {
    const saving = saveQueue.current
      .catch(() => undefined)
      .then(() => saveBudget(updated));
    saveQueue.current = saving;
    return saving;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await loadBudget();
        if (loaded) {
          updateFile(loaded);
          const monthStr = monthOf(new Date());
          setMonth(getMonth(loaded, monthStr));
        }
      } catch (err) {
        console.error("Load error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [updateFile]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const handleAppStateChange = (state: AppStateStatus) => {
    if (state === "active") {
      console.log("App active");
    }
  };

  const saveData = useCallback(async () => {
    try {
      await persistFile(fileRef.current);
    } catch (err) {
      console.error("Save error:", err);
    }
  }, [persistFile]);

  const addExpenseToMonth = useCallback(
    (expense: Expense) => {
      const updated = addExpense(fileRef.current, expense);
      updateFile(updated);
      setMonth(getMonth(updated, monthOf(new Date())));
    },
    [updateFile]
  );

  const addIncomeToMonth = useCallback(
    (income: Income) => {
      const updated = addIncome(fileRef.current, income);
      updateFile(updated);
      setMonth(getMonth(updated, monthOf(new Date())));
    },
    [updateFile]
  );

  const addBillToMonth = useCallback(
    (bill: Bill) => {
      const updated = addBill(fileRef.current, bill);
      updateFile(updated);
      setMonth(getMonth(updated, monthOf(new Date())));
    },
    [updateFile]
  );

  const updateMonth = useCallback((m: MonthData) => {
    setMonth(m);
  }, []);

  const mergeNewMessages = useCallback(
    async (messages: Detected[]) => {
      const updated = mergeMessages(fileRef.current, messages);
      updateFile(updated);
      await persistFile(updated);
    },
    [persistFile, updateFile]
  );

  const approveMessage = useCallback(
    async (id: string) => {
      const updated = approveDetected(fileRef.current, id);
      updateFile(updated);
      setMonth(getMonth(updated, monthOf(new Date())));
      await persistFile(updated);
    },
    [persistFile, updateFile]
  );

  const dismissMessage = useCallback(
    async (id: string) => {
      const updated = dismissDetected(fileRef.current, id);
      updateFile(updated);
      await persistFile(updated);
    },
    [persistFile, updateFile]
  );

  const value: BudgetContextType = {
    file,
    month,
    loading,
    saveData,
    addExpenseToMonth,
    addIncomeToMonth,
    addBillToMonth,
    updateMonth,
    mergeNewMessages,
    approveMessage,
    dismissMessage,
  };

  return (
    <BudgetContext.Provider value={value}>
      {children}
    </BudgetContext.Provider>
  );
};

export const useBudget = () => {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error("useBudget must be used within BudgetProvider");
  }
  return context;
};