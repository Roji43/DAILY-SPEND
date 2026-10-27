import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useBudget } from "../state";
import { formatRupee } from "../format";
import { colors, spacing } from "../theme";

export const TodayScreen = () => {
  const { month } = useBudget();

  const today = new Date().toISOString().split("T")[0];
  const todayExpenses = month.expenses.filter((e) => e.date === today);
  const totalToday = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Today's Spending</Text>
        <Text style={styles.amount}>{formatRupee(totalToday)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Expenses Today</Text>
        {todayExpenses.length === 0 ? (
          <Text style={styles.emptyText}>No expenses yet</Text>
        ) : (
          todayExpenses.map((expense) => (
            <View key={expense.id} style={styles.expenseItem}>
              <Text style={styles.expenseCategory}>{expense.category}</Text>
              <Text style={styles.expenseAmount}>
                {formatRupee(expense.amount)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  amount: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.primary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  expenseItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  expenseCategory: {
    fontSize: 14,
    color: colors.text,
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.text,
  },
});