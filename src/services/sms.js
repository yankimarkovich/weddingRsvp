const { toInternational } = require('../utils/phone');

// SMS4Free HTTP API - https://sms4free.co.il
// Sends one SMS. Throws on failure so callers can log/retry.
async function sendViaSms4Free(phone, text) {
  const { SMS4FREE_KEY, SMS4FREE_USER, SMS4FREE_PASS, SMS4FREE_SENDER } = process.env;
  if (!SMS4FREE_KEY || !SMS4FREE_USER || !SMS4FREE_PASS) {
    throw new Error('חסרים פרטי חשבון SMS4Free בקובץ ה-.env (SMS4FREE_KEY / SMS4FREE_USER / SMS4FREE_PASS)');
  }

  const res = await fetch('https://api.sms4free.co.il/ApiSMS/v2/SendSMS', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: SMS4FREE_KEY,
      user: SMS4FREE_USER,
      pass: SMS4FREE_PASS,
      sender: SMS4FREE_SENDER || 'Wedding',
      recipient: toInternational(phone),
      msg: text,
    }),
  });

  const data = await res.json().catch(() => null);
  // SMS4Free returns a positive numeric status on success and a negative code on failure.
  if (!data || typeof data.status !== 'number' || data.status <= 0) {
    throw new Error(`שליחת SMS נכשלה: ${data ? JSON.stringify(data) : res.status}`);
  }
  return data;
}

async function sendSms(phone, text) {
  return sendViaSms4Free(phone, text);
}

module.exports = { sendSms };
