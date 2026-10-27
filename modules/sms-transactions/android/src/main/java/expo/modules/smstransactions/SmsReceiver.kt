package expo.modules.smstransactions

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION ||
      !SmsTransactionStore.isEnabled(context)
    ) {
      return
    }

    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
    if (messages.isEmpty()) return

    val body = messages.joinToString(separator = "") { it.messageBody.orEmpty() }
    val timestamp = messages.minOfOrNull { it.timestampMillis } ?: System.currentTimeMillis()
    SmsTransactionStore.enqueue(context, SmsTransactionParser.parse(body, timestamp))
  }
}
