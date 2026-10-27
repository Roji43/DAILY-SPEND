import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Button,
  Linking,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { BudgetProvider, useBudget } from "./src/state";
import { formatRupee } from "./src/format";
import {
  acknowledgeSmsTransactions,
  addSmsTransactionsListener,
  getPendingSmsTransactions,
  isSmsImportEnabled,
  scanSmsInbox,
  setSmsImportEnabled,
} from "./modules/sms-transactions";

SplashScreen.preventAutoHideAsync();

const READ_SMS = PermissionsAndroid.PERMISSIONS.READ_SMS;
const RECEIVE_SMS = PermissionsAndroid.PERMISSIONS.RECEIVE_SMS;
const SMS_RATIONALE = {
  title: "Allow SMS transaction import",
  message:
    "Daily Spend reads your inbox when you choose to scan and can process new SMS while automatic import is enabled. Processing stays on this device. Only an opaque record ID, amount, debit or credit type, date, generic SMS label, and review status are kept; message text and sender are not stored or uploaded. The scan checks up to 5,000 newest inbox messages.",
  buttonPositive: "Continue",
  buttonNegative: "Not now",
};

const MainApp = () => {
  const {
    file,
    loading,
    mergeNewMessages,
    approveMessage,
    dismissMessage,
  } = useBudget();
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsStatus, setSmsStatus] = useState("SMS import is off.");
  const [busy, setBusy] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const syncing = useRef(false);
  const syncRequested = useRef(false);

  const syncPendingTransactions = useCallback(async () => {
    if (syncing.current) {
      syncRequested.current = true;
      return;
    }

    syncing.current = true;
    try {
      do {
        syncRequested.current = false;
        const pending = await getPendingSmsTransactions();
        if (pending.length === 0) continue;
        await mergeNewMessages(pending);
        await acknowledgeSmsTransactions(pending.map((transaction) => transaction.id));
      } while (syncRequested.current);
    } catch (error) {
      console.error("SMS transaction sync failed:", error);
      setSmsStatus("Could not save received SMS transactions. They will be retried.");
    } finally {
      syncing.current = false;
    }
  }, [mergeNewMessages]);

  useEffect(() => {
    const subscription = addSmsTransactionsListener(() => {
      void syncPendingTransactions();
    });
    return () => subscription.remove();
  }, [syncPendingTransactions]);

  useEffect(() => {
    if (loading || Platform.OS !== "android") return;

    let mounted = true;
    const initializeSmsImport = async () => {
      try {
        const [enabled, canRead, canReceive] = await Promise.all([
          isSmsImportEnabled(),
          PermissionsAndroid.check(READ_SMS),
          PermissionsAndroid.check(RECEIVE_SMS),
        ]);
        if (!mounted) return;
        const active = enabled && canReceive;
        setSmsEnabled(active);
        setSmsStatus(
          active
            ? "Automatic import is on. SMS is processed on this device."
            : enabled && !canReceive
              ? "Automatic import is paused because SMS receive permission is unavailable."
              : canRead
                ? "Inbox access is allowed. Turn on import to scan messages."
                : "SMS import is off. No inbox messages are being read."
        );
        await syncPendingTransactions();
      } catch (error) {
        console.error("SMS import status check failed:", error);
        if (mounted) setSmsStatus("Could not check SMS import status.");
      }
    };

    void initializeSmsImport();
    return () => {
      mounted = false;
    };
  }, [loading, syncPendingTransactions]);

  useEffect(() => {
    if (Platform.OS !== "android" || !smsEnabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncPendingTransactions();
    });
    return () => subscription.remove();
  }, [smsEnabled, syncPendingTransactions]);

  useEffect(() => {
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error("Splash error:", error);
      }
    };

    if (!loading) void hideSplash();
  }, [loading]);

  const enableAndScan = async () => {
    setBusy(true);
    setPermissionBlocked(false);
    try {
      const readResult = await PermissionsAndroid.request(READ_SMS, SMS_RATIONALE);
      if (readResult !== PermissionsAndroid.RESULTS.GRANTED) {
        const blocked = readResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
        setPermissionBlocked(blocked);
        setSmsStatus(
          blocked
            ? "Inbox access was blocked. Allow SMS access in Android settings to scan."
            : "Inbox access was not granted; no messages were scanned."
        );
        return;
      }

      const receiveResult = await PermissionsAndroid.request(
        RECEIVE_SMS,
        SMS_RATIONALE
      );
      const receiveAllowed = receiveResult === PermissionsAndroid.RESULTS.GRANTED;
      if (receiveAllowed) {
        await setSmsImportEnabled(true);
        setSmsEnabled(true);
      } else {
        await setSmsImportEnabled(false);
        setSmsEnabled(false);
      }

      const transactions = await scanSmsInbox();
      if (transactions.length > 0) {
        await mergeNewMessages(transactions);
      }
      await syncPendingTransactions();
      const receiveBlocked =
        receiveResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
      setPermissionBlocked(receiveBlocked);
      setSmsStatus(
        receiveAllowed
          ? `Scanned the inbox; ${transactions.length} transaction${transactions.length === 1 ? "" : "s"} found. Automatic import is on.`
          : `Scanned the inbox; ${transactions.length} transaction${transactions.length === 1 ? "" : "s"} found. Automatic import is off because receive permission was not granted.`
      );
    } catch (error) {
      console.error("SMS inbox scan failed:", error);
      setSmsStatus(
        error instanceof Error
          ? `SMS import failed: ${error.message}`
          : "SMS import failed. Check the permissions and try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const onEnablePressed = () => {
    Alert.alert(
      "Sensitive SMS access",
      SMS_RATIONALE.message,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => void enableAndScan() },
      ],
      { cancelable: true }
    );
  };

  const turnOffAutomaticImport = () => {
    Alert.alert(
      "Turn off automatic import?",
      "New SMS will no longer be processed. This does not revoke Android's permission; you can do that separately in system settings.",
      [
        { text: "Keep on", style: "cancel" },
        {
          text: "Turn off",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await setSmsImportEnabled(false);
                setSmsEnabled(false);
                setSmsStatus("Automatic SMS import is off.");
              } catch (error) {
                console.error("Could not disable SMS import:", error);
                setSmsStatus("Could not turn off automatic SMS import.");
              }
            })();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2d5016" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const detected = [...file.detected].reverse();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Daily Spend</Text>
      <Text style={styles.subtitle}>Private, on-device SMS transaction import</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>SMS transaction import</Text>
        {Platform.OS === "android" ? (
          <>
            <Text style={styles.body}>{smsStatus}</Text>
            <Text style={styles.privacy}>
              Message text and sender details are not saved. Only extracted transaction
              details are stored locally; nothing is sent over the network.
            </Text>
            {busy ? (
              <ActivityIndicator color="#2d5016" />
            ) : (
              <>
                <Button
                  title={smsEnabled ? "Scan inbox again" : "Enable import & scan inbox"}
                  onPress={onEnablePressed}
                />
                {smsEnabled ? (
                  <View style={styles.secondaryButton}>
                    <Button
                      title="Turn off automatic import"
                      color="#8d3030"
                      onPress={turnOffAutomaticImport}
                    />
                  </View>
                ) : null}
                {permissionBlocked ? (
                  <View style={styles.secondaryButton}>
                    <Button
                      title="Open Android app settings"
                      onPress={() => void Linking.openSettings()}
                    />
                  </View>
                ) : null}
              </>
            )}
          </>
        ) : (
          <Text style={styles.body}>
            SMS import is available only in the Android APK. No SMS permission is
            requested on this platform.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Detected transactions</Text>
        {detected.length === 0 ? (
          <Text style={styles.body}>No transactions have been imported.</Text>
        ) : (
          detected.slice(0, 20).map((transaction) => (
            <View key={transaction.id} style={styles.transaction}>
              <View style={styles.transactionDetails}>
                <View style={styles.transactionDescription}>
                  <Text style={styles.transactionType}>
                    {transaction.type === "debit" ? "Debit" : "Credit"}
                  </Text>
                  <Text style={styles.transactionMeta}>
                    {transaction.date} · {transaction.source} · {transaction.status}
                  </Text>
                </View>
                <Text style={styles.transactionAmount}>
                  {formatRupee(transaction.amount)}
                </Text>
              </View>
              {transaction.status === "pending" ? (
                <View style={styles.transactionActions}>
                  <View style={styles.actionButton}>
                    <Button
                      title="Approve"
                      onPress={() =>
                        void approveMessage(transaction.id).catch((error) => {
                          console.error("Could not approve transaction:", error);
                          setSmsStatus("Could not save the approved transaction.");
                        })
                      }
                    />
                  </View>
                  <View style={styles.actionButton}>
                    <Button
                      title="Dismiss"
                      color="#8d3030"
                      onPress={() =>
                        void dismissMessage(transaction.id).catch((error) => {
                          console.error("Could not dismiss transaction:", error);
                          setSmsStatus("Could not save the dismissed transaction.");
                        })
                      }
                    />
                  </View>
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BudgetProvider>
          <MainApp />
        </BudgetProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 20,
    paddingTop: 32,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  title: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#2d5016",
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 20,
    color: "#666",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#222",
    marginBottom: 10,
  },
  body: {
    color: "#555",
    lineHeight: 21,
    marginBottom: 12,
  },
  privacy: {
    color: "#666",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  secondaryButton: {
    marginTop: 8,
  },
  transaction: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ddd",
  },
  transactionDetails: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  transactionDescription: {
    flex: 1,
    marginRight: 12,
  },
  transactionType: {
    fontWeight: "600",
    color: "#222",
  },
  transactionMeta: {
    color: "#666",
    fontSize: 12,
    marginTop: 3,
  },
  transactionAmount: {
    color: "#222",
    fontWeight: "600",
  },
  transactionActions: {
    flexDirection: "row",
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
});
