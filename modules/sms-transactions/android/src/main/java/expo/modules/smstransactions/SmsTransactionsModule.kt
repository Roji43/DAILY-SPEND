package expo.modules.smstransactions

import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.Telephony
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.launch

class SmsTransactionsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DailySpendSmsTransactions")
    Events("onNewTransactions")

    AsyncFunction<Boolean>("isImportEnabled") {
      SmsTransactionStore.isEnabled(requireContext())
    }

    AsyncFunction("setImportEnabled") { enabled: Boolean ->
      val context = requireContext()
      if (enabled && !hasPermission(context, "android.permission.RECEIVE_SMS")) {
        throw IllegalStateException("SMS receive permission has not been granted.")
      }
      SmsTransactionStore.setEnabled(context, enabled)
      SmsTransactionStore.isEnabled(context)
    }

    AsyncFunction<List<Map<String, Any>>>("scanInbox") {
      val context = requireContext()
      if (!hasPermission(context, "android.permission.READ_SMS")) {
        throw IllegalStateException("SMS read permission has not been granted.")
      }

      val transactions = mutableMapOf<String, SmsTransaction>()
      val cursor: Cursor? = context.contentResolver.query(
        Uri.parse("content://sms/inbox"),
        arrayOf(Telephony.Sms.BODY, Telephony.Sms.DATE),
        null,
        null,
        "${Telephony.Sms.DATE} DESC"
      )
      cursor?.use {
        val bodyColumn = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
        val dateColumn = it.getColumnIndexOrThrow(Telephony.Sms.DATE)
        var scanned = 0
        while (it.moveToNext() && scanned < 5000) {
          scanned += 1
          val body = it.getString(bodyColumn) ?: continue
          val timestamp = it.getLong(dateColumn)
          SmsTransactionParser.parse(body, timestamp).forEach { transaction ->
            transactions.putIfAbsent(transaction.id, transaction)
          }
        }
      }
      transactions.values.map { it.asMap() }
    }

    AsyncFunction<List<Map<String, Any>>>("getPendingTransactions") {
      SmsTransactionStore.pending(requireContext())
    }

    AsyncFunction("acknowledgeTransactions") { ids: List<String> ->
      SmsTransactionStore.acknowledge(requireContext(), ids.toSet())
    }

    OnCreate {
      SmsTransactionStore.onNewTransactions = { transactions ->
        appContext.mainQueue.launch {
          sendEvent("onNewTransactions", mapOf("transactions" to transactions))
        }
      }
    }

    OnDestroy {
      SmsTransactionStore.onNewTransactions = null
    }
  }

  private fun requireContext(): Context =
    appContext.reactContext ?: throw IllegalStateException("Android context is unavailable.")

  private fun hasPermission(context: Context, permission: String): Boolean =
    context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
}
