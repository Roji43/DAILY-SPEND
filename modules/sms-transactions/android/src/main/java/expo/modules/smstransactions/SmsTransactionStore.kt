package expo.modules.smstransactions

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

internal object SmsTransactionStore {
  private const val PREFERENCES = "daily_spend_sms_transactions"
  private const val ENABLED_KEY = "automatic_import_enabled"
  private const val QUEUE_KEY = "pending_transactions"
  private const val MAX_PENDING = 1000
  private val lock = Any()

  @Volatile
  var onNewTransactions: ((List<Map<String, Any>>) -> Unit)? = null

  fun preferences(context: Context) =
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  fun isEnabled(context: Context): Boolean =
    preferences(context).getBoolean(ENABLED_KEY, false)

  fun setEnabled(context: Context, enabled: Boolean) {
    preferences(context).edit().putBoolean(ENABLED_KEY, enabled).commit()
  }

  fun enqueue(context: Context, transactions: List<SmsTransaction>) {
    if (transactions.isEmpty()) return
    val fresh = synchronized(lock) {
      val queue = readQueue(context).associateBy { it.id }.toMutableMap()
      val newlyQueued = transactions.filter { !queue.containsKey(it.id) }
      newlyQueued.forEach { queue[it.id] = it }
      val bounded = queue.values.toList().takeLast(MAX_PENDING)
      writeQueue(context, bounded)
      newlyQueued
    }
    if (fresh.isNotEmpty()) {
      onNewTransactions?.invoke(fresh.map { it.asMap() })
    }
  }

  fun pending(context: Context): List<Map<String, Any>> =
    synchronized(lock) { readQueue(context).map { it.asMap() } }

  fun acknowledge(context: Context, ids: Set<String>) {
    if (ids.isEmpty()) return
    synchronized(lock) {
      writeQueue(context, readQueue(context).filterNot { ids.contains(it.id) })
    }
  }

  private fun readQueue(context: Context): List<SmsTransaction> {
    val encoded = preferences(context).getString(QUEUE_KEY, null) ?: return emptyList()
    return try {
      val json = JSONArray(encoded)
      (0 until json.length()).mapNotNull { index ->
        val item = json.optJSONObject(index) ?: return@mapNotNull null
        val amount = item.optDouble("amount", Double.NaN)
        val type = item.optString("type")
        val id = item.optString("id")
        val date = item.optString("date")
        if (!amount.isFinite() || amount <= 0 || id.isBlank() ||
          (type != "debit" && type != "credit") ||
          !date.matches(Regex("""\d{4}-\d{2}-\d{2}"""))
        ) {
          null
        } else {
          SmsTransaction(id, amount, type, date)
        }
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun writeQueue(context: Context, transactions: List<SmsTransaction>) {
    val json = JSONArray()
    transactions.takeLast(MAX_PENDING).forEach { transaction ->
      json.put(
        JSONObject()
          .put("id", transaction.id)
          .put("amount", transaction.amount)
          .put("type", transaction.type)
          .put("date", transaction.date)
      )
    }
    preferences(context).edit().putString(QUEUE_KEY, json.toString()).commit()
  }
}
