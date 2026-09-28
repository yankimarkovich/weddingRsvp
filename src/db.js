const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'wedding.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS event (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    title TEXT NOT NULL DEFAULT '',
    event_date TEXT NOT NULL DEFAULT '',
    venue_name TEXT NOT NULL DEFAULT '',
    venue_address TEXT NOT NULL DEFAULT '',
    waze_link TEXT NOT NULL DEFAULT '',
    image_path TEXT NOT NULL DEFAULT '',
    rsvp_intro TEXT NOT NULL DEFAULT 'נשמח לראותכם בשמחתנו!',
    whatsapp_template TEXT NOT NULL DEFAULT 'היי! מוזמנים לחתונה שלנו 💍 לאישור הגעה: {link}'
  );

  INSERT OR IGNORE INTO event (id) VALUES (1);

  CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
    guest_count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reminder_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offset_days INTEGER NOT NULL,
    send_time TEXT NOT NULL,
    message_template TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS reminder_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL,
    guest_id INTEGER NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (rule_id, guest_id)
  );
`);

module.exports = db;
