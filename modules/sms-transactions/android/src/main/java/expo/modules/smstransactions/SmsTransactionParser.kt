package expo.modules.smstransactions

import java.math.BigDecimal
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

internal data class SmsTransaction(
  val id: String,
  val amount: Double,
  val type: String,
  val date: String
) {
  fun asMap(): Map<String, Any> = mapOf(
    "id" to id,
    "amount" to amount,
    "type" to type,
    "source" to "SMS",
    "date" to date,
    "status" to "pending"
  )
}

internal object SmsTransactionParser {
  private val otpPattern = Regex("""\b[0-9]{4,6}\b""")
  private val moneyContextPattern = Regex("""amount|rupee|₹""", RegexOption.IGNORE_CASE)
  private val amountPattern = Regex("""₹?\s*([0-9,]+(?:\.[0-9]{2})?)""")
  private val debitPattern = Regex("""debited|spent|paid|withdrawn""", RegexOption.IGNORE_CASE)
  private val creditPattern = Regex("""credited|received|salary|deposited""", RegexOption.IGNORE_CASE)

  fun parse(message: String, timestampMillis: Long): List<SmsTransaction> {
    if (otpPattern.containsMatchIn(message) && !moneyContextPattern.containsMatchIn(message)) {
      return emptyList()
    }

    val isDebit = debitPattern.containsMatchIn(message)
    val isCredit = creditPattern.containsMatchIn(message)
    if (isDebit == isCredit) return emptyList()
    val type = if (isDebit) "debit" else "credit"
    val amountText = amountPattern.find(message)?.groupValues?.getOrNull(1) ?: return emptyList()
    val amount = amountText.replace(",", "").toDoubleOrNull() ?: return emptyList()
    if (!amount.isFinite() || amount <= 0) return emptyList()

    val date = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(Date(timestampMillis))
    val amountKey = BigDecimal.valueOf(amount).stripTrailingZeros().toPlainString()
    return listOf(
      SmsTransaction(
        id = "sms-$timestampMillis-$type-$amountKey",
        amount = amount,
        type = type,
        date = date
      )
    )
  }
}
