const cron = require('node-cron');
const db = require('../db');
const { sendSms } = require('./sms');

const CATCH_UP_WINDOW_MS = 24 * 60 * 60 * 1000; // send late reminders if server was briefly down, but never more than a day late
const DELAY_BETWEEN_SMS_MS = 300;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function computeTargetDate(eventDate, offsetDays, sendTime) {
  const target = new Date(eventDate.getTime() - offsetDays * 24 * 60 * 60 * 1000);
  const [hh, mm] = sendTime.split(':').map(Number);
  target.setHours(hh, mm, 0, 0);
  return target;
}

async function checkReminders() {
  const event = db.prepare('SELECT * FROM event WHERE id = 1').get();
  if (!event || !event.event_date) return;

  const eventDate = new Date(event.event_date);
  if (Number.isNaN(eventDate.getTime())) return;

  const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
  const link = `${baseUrl}/rsvp`;
  const now = new Date();

  const rules = db.prepare('SELECT * FROM reminder_rules WHERE active = 1').all();

  for (const rule of rules) {
    const target = computeTargetDate(eventDate, rule.offset_days, rule.send_time);
    const elapsed = now - target;
    if (elapsed < 0 || elapsed > CATCH_UP_WINDOW_MS) continue;

    const pendingGuests = db.prepare("SELECT * FROM guests WHERE status = 'pending'").all();
    const alreadySent = new Set(
      db.prepare('SELECT guest_id FROM reminder_log WHERE rule_id = ?').all(rule.id).map((r) => r.guest_id)
    );

    for (const guest of pendingGuests) {
      if (alreadySent.has(guest.id)) continue;

      const text = rule.message_template.replaceAll('{name}', guest.name).replaceAll('{link}', link);
      try {
        await sendSms(guest.phone, text);
        db.prepare('INSERT OR IGNORE INTO reminder_log (rule_id, guest_id) VALUES (?, ?)').run(rule.id, guest.id);
        console.log(`[reminder] נשלח ל-${guest.name} (${guest.phone}) - כלל #${rule.id}`);
      } catch (err) {
        console.error(`[reminder] שליחה נכשלה ל-${guest.name} (${guest.phone}): ${err.message}`);
      }
      await sleep(DELAY_BETWEEN_SMS_MS);
    }
  }
}

function startScheduler() {
  // Runs every 10 minutes; each rule fires once thanks to reminder_log.
  cron.schedule('*/10 * * * *', () => {
    checkReminders().catch((err) => console.error('[reminder] שגיאה כללית בבדיקת תזכורות:', err));
  });
  console.log('[reminder] המתזמן פעיל - בדיקה כל 10 דקות');
}

module.exports = { startScheduler, checkReminders };
