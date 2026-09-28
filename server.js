require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');

const adminRoutes = require('./src/routes/admin');
const publicRoutes = require('./src/routes/public');
const { startScheduler } = require('./src/services/scheduler');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' },
  })
);

app.get('/', (req, res) => res.redirect('/rsvp'));
app.use('/admin', adminRoutes);
app.use('/', publicRoutes);

app.use((req, res) => res.status(404).send('הדף לא נמצא'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`השרת רץ על פורט ${PORT}`);
  startScheduler();
});
