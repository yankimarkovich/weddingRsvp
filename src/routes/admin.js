const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { normalizeLocal, isValidIsraeliMobile } = require('../utils/phone');
const { sendSms } = require('../services/sms');

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', '..', 'public', 'uploads'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `event-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      return cb(new Error('רק קבצי תמונה (JPG/PNG/WEBP) נתמכים'));
    }
    cb(null, true);
  },
});

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin');
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password && timingSafeEqual(password, process.env.ADMIN_PASSWORD || '')) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.status(401).render('login', { error: 'סיסמה שגויה' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.get('/', requireAuth, (req, res) => {
  const event = db.prepare('SELECT * FROM event WHERE id = 1').get();
  const guests = db.prepare('SELECT * FROM guests ORDER BY created_at DESC').all();
  const rules = db.prepare('SELECT * FROM reminder_rules ORDER BY offset_days DESC').all();

  const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const rsvpLink = `${baseUrl}/rsvp`;

  const stats = {
    total: guests.length,
    confirmed: guests.filter((g) => g.status === 'confirmed').length,
    declined: guests.filter((g) => g.status === 'declined').length,
    pending: guests.filter((g) => g.status === 'pending').length,
    totalSeats: guests.filter((g) => g.status === 'confirmed').reduce((s, g) => s + g.guest_count, 0),
  };

  res.render('dashboard', {
    event,
    guests,
    rules,
    stats,
    rsvpLink,
    whatsappPreview: (event.whatsapp_template || '').replaceAll('{link}', rsvpLink),
    error: req.query.error || null,
    success: req.query.success || null,
  });
});

router.post('/event', requireAuth, upload.single('image'), (req, res) => {
  try {
    const {
      title,
      event_date,
      hebrew_date,
      venue_name,
      venue_address,
      waze_link,
      rsvp_intro,
      whatsapp_template,
      time_reception,
      time_ceremony,
      time_party,
    } = req.body;
    const current = db.prepare('SELECT image_path FROM event WHERE id = 1').get();

    let imagePath = current.image_path;
    if (req.file) {
      if (imagePath) {
        const oldFile = path.join(__dirname, '..', '..', 'public', imagePath);
        fs.unlink(oldFile, () => {});
      }
      imagePath = `/uploads/${req.file.filename}`;
    }

    db.prepare(
      `UPDATE event SET title=?, event_date=?, hebrew_date=?, venue_name=?, venue_address=?, waze_link=?, image_path=?, rsvp_intro=?, whatsapp_template=?, time_reception=?, time_ceremony=?, time_party=? WHERE id=1`
    ).run(
      title,
      event_date,
      hebrew_date || '',
      venue_name,
      venue_address,
      waze_link || '',
      imagePath,
      rsvp_intro,
      whatsapp_template,
      time_reception || '',
      time_ceremony || '',
      time_party || ''
    );

    res.redirect('/admin?success=' + encodeURIComponent('פרטי האירוע עודכנו'));
  } catch (err) {
    res.redirect('/admin?error=' + encodeURIComponent(err.message));
  }
});

router.post('/guests', requireAuth, (req, res) => {
  try {
    const { name, phone, bulk } = req.body;
    const insert = db.prepare(
      'INSERT INTO guests (name, phone) VALUES (?, ?) ON CONFLICT(phone) DO NOTHING'
    );

    let added = 0;
    let skipped = 0;

    if (name && phone) {
      if (!isValidIsraeliMobile(phone)) throw new Error(`מספר טלפון לא תקין: ${phone}`);
      const info = insert.run(name.trim(), normalizeLocal(phone));
      info.changes ? added++ : skipped++;
    }

    if (bulk && bulk.trim()) {
      const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const [n, p] = line.split(',').map((s) => s && s.trim());
        if (!n || !p || !isValidIsraeliMobile(p)) {
          skipped++;
          continue;
        }
        const info = insert.run(n, normalizeLocal(p));
        info.changes ? added++ : skipped++;
      }
    }

    res.redirect('/admin?success=' + encodeURIComponent(`נוספו ${added} מוזמנים${skipped ? `, ${skipped} דולגו (כפילות/מספר לא תקין)` : ''}`));
  } catch (err) {
    res.redirect('/admin?error=' + encodeURIComponent(err.message));
  }
});

router.post('/guests/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!['pending', 'confirmed', 'declined'].includes(status)) {
    return res.redirect('/admin?error=' + encodeURIComponent('סטטוס לא תקין'));
  }
  db.prepare("UPDATE guests SET status=?, updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
  res.redirect('/admin');
});

router.post('/guests/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM guests WHERE id=?').run(req.params.id);
  res.redirect('/admin');
});

router.post('/reminders', requireAuth, (req, res) => {
  const { offset_days, send_time, message_template } = req.body;
  if (!offset_days || !send_time || !message_template) {
    return res.redirect('/admin?error=' + encodeURIComponent('יש למלא את כל שדות התזכורת'));
  }
  db.prepare(
    'INSERT INTO reminder_rules (offset_days, send_time, message_template) VALUES (?, ?, ?)'
  ).run(Number(offset_days), send_time, message_template);
  res.redirect('/admin?success=' + encodeURIComponent('תזכורת נוספה'));
});

router.post('/reminders/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM reminder_rules WHERE id=?').run(req.params.id);
  res.redirect('/admin');
});

router.post('/test-sms', requireAuth, async (req, res) => {
  const { phone, message, name } = req.body;
  if (!phone || !isValidIsraeliMobile(phone)) {
    return res.redirect('/admin?error=' + encodeURIComponent('נא להזין מספר טלפון נייד תקין לבדיקה'));
  }

  const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const link = `${baseUrl}/rsvp`;
  const sampleName = (name && name.trim()) || 'אורח לדוגמה';
  const text =
    message && message.trim()
      ? message.trim().replaceAll('{name}', sampleName).replaceAll('{link}', link)
      : 'זוהי הודעת בדיקה ממערכת אישורי ההגעה לחתונה שלכם 💍 אם קיבלתם אותה - השליחה עובדת!';

  try {
    await sendSms(phone, text);
    res.redirect('/admin?success=' + encodeURIComponent(`הודעת בדיקה נשלחה ל-${normalizeLocal(phone)}`));
  } catch (err) {
    res.redirect('/admin?error=' + encodeURIComponent('שליחת הבדיקה נכשלה: ' + err.message));
  }
});

module.exports = router;
