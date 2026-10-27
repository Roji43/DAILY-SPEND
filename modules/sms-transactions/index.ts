import { Platform } from "react-native";
import {
  requireNativeModule,
  type EventSubscription,
} from "expo-modules-core";
import { Detected } from "../../src/types";

type NativeSmsTransactions = {
  isImportEnabled(): Promise<boolean>;
  setImportEnabled(enabled: boolean): Promise<boolean>;
  scanInbox(): Promise<Detected[]>;
  getPendingTransactions(): Promise<Detected[]>;
  acknowledgeTransactions(ids: string[]): Promise<void>;
  addListener(
    eventName: "onNewTransactions",
    listener: (event: { transactions: Detected[] }) => void
  ): EventSubscription;
};

const nativeModule =
  Platform.OS === "android"
    ? requireNativeModule<NativeSmsTransactions>("DailySpendSmsTransactions")
    : null;

const getNativeModule = (): NativeSmsTransactions => {
  if (!nativeModule) {
    throw new Error("SMS transaction import is only available on Android.");
  }
  return nativeModule;
};

export const isSmsImportEnabled = () => getNativeModule().isImportEnabled();
export const setSmsImportEnabled = (enabled: boolean) =>
  getNativeModule().setImportEnabled(enabled);
export const scanSmsInbox = () => getNativeModule().scanInbox();
export const getPendingSmsTransactions = () =>
  getNativeModule().getPendingTransactions();
export const acknowledgeSmsTransactions = (ids: string[]) =>
  getNativeModule().acknowledgeTransactions(ids);
export const addSmsTransactionsListener = (
  listener: (transactions: Detected[]) => void
) =>
  getNativeModule().addListener("onNewTransactions", ({ transactions }) =>
    listener(transactions)
  );
