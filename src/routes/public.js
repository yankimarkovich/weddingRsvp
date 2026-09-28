const express = require('express');
const db = require('../db');
const { normalizeLocal, isValidIsraeliMobile } = require('../utils/phone');

const router = express.Router();

function getBaseUrl(req) {
  return (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

router.get('/rsvp', (req, res) => {
  const event = db.prepare('SELECT * FROM event WHERE id = 1').get();
  const baseUrl = getBaseUrl(req);
  res.render('rsvp', {
    event,
    imageUrl: event.image_path ? `${baseUrl}${event.image_path}` : null,
    pageUrl: `${baseUrl}/rsvp`,
    error: null,
    submitted: false,
  });
});

router.post('/rsvp', (req, res) => {
  const event = db.prepare('SELECT * FROM event WHERE id = 1').get();
  const baseUrl = getBaseUrl(req);
  const renderWithError = (error) =>
    res.status(400).render('rsvp', {
      event,
      imageUrl: event.image_path ? `${baseUrl}${event.image_path}` : null,
      pageUrl: `${baseUrl}/rsvp`,
      error,
      submitted: false,
    });

  const { name, phone, attending } = req.body;
  let guestCount = parseInt(req.body.guest_count, 10);

  if (!name || !name.trim()) return renderWithError('נא להזין שם מלא');
  if (!phone || !isValidIsraeliMobile(phone)) return renderWithError('נא להזין מספר טלפון נייד תקין (05XXXXXXXX)');
  if (attending !== 'yes' && attending !== 'no') return renderWithError('נא לבחור אם מגיעים');

  if (attending === 'yes') {
    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 30) {
      return renderWithError('נא להזין כמות אורחים תקינה');
    }
  } else {
    guestCount = 0;
  }

  const status = attending === 'yes' ? 'confirmed' : 'declined';
  const normalizedPhone = normalizeLocal(phone);

  db.prepare(
    `INSERT INTO guests (name, phone, status, guest_count, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(phone) DO UPDATE SET
       name = excluded.name,
       status = excluded.status,
       guest_count = excluded.guest_count,
       updated_at = datetime('now')`
  ).run(name.trim(), normalizedPhone, status, guestCount);

  res.render('rsvp', {
    event,
    imageUrl: event.image_path ? `${baseUrl}${event.image_path}` : null,
    pageUrl: `${baseUrl}/rsvp`,
    error: null,
    submitted: true,
    attending,
  });
});

module.exports = router;
