# מערכת אישורי הגעה לחתונה

פאנל ניהול + דף אישור הגעה ציבורי + תזכורות SMS אוטומטיות.

## הרצה מקומית

1. התקנת חבילות:
   ```
   npm install
   ```
2. יצירת קובץ סביבה:
   ```
   cp .env.example .env
   ```
   ולמלא לפחות `ADMIN_PASSWORD` ו-`SESSION_SECRET` (כל מחרוזת רנדומלית).
3. הרצה:
   ```
   npm start
   ```
4. פאנל ניהול: http://localhost:3000/admin
   דף אישור הגעה: http://localhost:3000/rsvp

## חיבור SMS4Free

1. נרשמים בכתובת https://sms4free.co.il ורוכשים חבילת קרדיט.
2. באזור האישי מוצאים את פרטי ה-API (Key / User / Pass) וממלאים אותם ב-`.env`.
3. בפאנל הניהול יש כפתור "שליחת הודעת SMS לדוגמה" לבדיקה שהחיבור עובד לפני שליחה אמיתית לאורחים.
4. **הערה**: פרטי ה-API המדויקים (שמות השדות) מבוססים על התיעוד הנפוץ של SMS4Free. אם השליחה נכשלת אחרי הזנת הפרטים, יש לבדוק מול התיעוד העדכני באזור האישי שלך ולעדכן את `src/services/sms.js` בהתאם — זה קובץ אחד קטן.

## העלאה ל-Railway (production)

1. יוצרים repo ב-GitHub ודוחפים אליו את הקוד (בלי `.env` וללא `node_modules` — כבר מוגדר ב-`.gitignore`).
2. נכנסים ל-https://railway.com, מתחברים עם GitHub, יוצרים "New Project" → "Deploy from GitHub repo" ובוחרים את ה-repo.
3. בהגדרות הפרויקט (Variables) מוסיפים את כל המשתנים מ-`.env.example` עם הערכים האמיתיים, כולל:
   - `BASE_URL` = הכתובת הציבורית שתקבלו מ-Railway (או הדומיין המותאם, אם חיברתם)
   - `ADMIN_PASSWORD`, `SESSION_SECRET`
   - `SMS4FREE_KEY`, `SMS4FREE_USER`, `SMS4FREE_PASS`, `SMS4FREE_SENDER`
4. מוסיפים **Volume** (דיסק קבוע) ומחברים אותו לנתיב `/app/data` כדי שמסד הנתונים (SQLite) לא יימחק בכל דיפלוי מחדש.
5. Railway יריץ אוטומטית `npm install` ואז `npm start`.
6. אחרי שהאפליקציה עולה, בודקים שהכתובת הציבורית עובדת, ומעדכנים את `BASE_URL` בהתאם אם צריך (ואז עושים Redeploy).

### חיבור דומיין אישי

1. רוכשים דומיין אצל רשם כלשהו (למשל domain.co.il או Namecheap).
2. בהגדרות הפרויקט ב-Railway → Settings → Domains → Custom Domain, מזינים את הדומיין שרכשתם.
3. Railway יציג רשומת DNS (CNAME) להוספה אצל הרשם שבו רכשתם את הדומיין.
4. אחרי שה-DNS מתעדכן (יכול לקחת עד כמה שעות), מעדכנים את `BASE_URL` ל-`https://your-domain.com` ועושים Redeploy.

## מבנה הפרויקט

```
server.js                 נקודת הכניסה
src/db.js                 חיבור SQLite + יצירת טבלאות
src/routes/admin.js        פאנל ניהול (מוגן בסיסמה)
src/routes/public.js       דף אישור הגעה ציבורי
src/services/sms.js        שליחת SMS (SMS4Free)
src/services/scheduler.js  מתזמן תזכורות (רץ כל 10 דקות)
views/                     תבניות EJS (עברית, RTL)
public/                    CSS + תמונות שהועלו
```
