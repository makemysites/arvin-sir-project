# Aptitude Exam Portal

A free online examination platform with its own custom backend. The teacher (admin) uploads questions from an Excel sheet, starts a timed exam whenever they want, and views scores and a leaderboard. Students sign in with an email OTP, write the exam under anti-cheating rules, and can later review every question with their answer and the correct answer.

**Total cost: ₹0.** Runs entirely on free tiers: Vercel (hosting) + MongoDB Atlas (database, free forever) + Brevo (OTP emails, 300/day free). Authentication is built into the app itself (email OTP + signed session cookies) — no auth service, no project limits.

---

## Features

**Admin (teacher)**
- Create an exam with any title and duration (in minutes)
- Upload questions from Excel — columns: `Question | Option A | Option B | Option C | Option D | Correct (A/B/C/D) | Section (optional)` (see `sample-questions.xlsx`)
- View and edit every question in the browser (fix typos, change options/answers, add or delete questions) while the exam is a draft
- Upload study materials (PDFs/notes up to 4 MB) that students download from their dashboard
- See every registered student (name, email, signup date) under Admin → Students
- Preview the parsed questions before saving
- Start the exam with one click, end it with one click
- Live results table: who submitted, who is still writing, scores, cheating warnings
- Leaderboard and CSV download of all results
- Can open any student's answer sheet

**Students**
- Sign in with email + 6-digit OTP (only needed once — they stay signed in for 30 days)
- Timed exam in fullscreen with a question palette, instant answer saving, and resume-after-refresh
- Score shown immediately on submit
- After the teacher ends the exam: full answer review (their choice vs. the correct one, per question) and the class leaderboard

**Anti-cheating**
- Exam runs in fullscreen; leaving it, switching tabs, or switching apps triggers a warning
- After **2 warnings**, the next violation **auto-submits** the exam (change `MAX_VIOLATIONS` in `src/lib/types.ts`)
- Copy, paste, right-click, and text selection are blocked during the exam
- The timer and scoring run on the **server** — refreshing, closing the page, or changing the device clock doesn't add time
- Correct answers are **never sent to the browser** during the exam, so DevTools can't reveal them
- All violations are recorded and shown to the teacher next to each score

---

## Setup (one time, ~25 minutes, all free)

### 1. MongoDB Atlas (the database)

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) → sign up free → create a deployment → choose **M0 Free** → region: Mumbai (or nearest) → Create.
2. When it asks to create a **database user**: pick a username and password (no special characters in the password keeps things simple — save both).
3. **Network access**: choose "Allow access from anywhere" (`0.0.0.0/0`). This is required because Vercel's servers have changing IPs. (Atlas may show this under Network Access → Add IP Address.)
4. Click **Connect → Drivers** and copy the connection string. It looks like:
   `mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   Replace `USERNAME`/`PASSWORD` with the user from step 2. This whole string is your `MONGODB_URI`.

That's it — no tables to create. The app creates its collections and indexes automatically on first run.

### 2. Brevo (free SMTP so OTP emails arrive)

1. Sign up at [brevo.com](https://www.brevo.com) (free plan, 300 emails/day, no card).
2. **Verify a sender**: Brevo → **Senders, Domains & Dedicated IPs** → **Senders** → add the teacher's email → click the verification link Brevo sends.
3. **SMTP credentials**: click your name (top-right) → **SMTP & API** → **SMTP** tab → **Generate a new SMTP key**. Note the server (`smtp-relay.brevo.com`), port (`587`), your login, and the key.

> Each student only needs an OTP **once** (they stay signed in for 30 days), so 300/day comfortably covers a 200-student class. Ask students to sign in a day before the first exam to spread out the emails.

### 3. Configure and run locally

```bash
# in the project folder
cp .env.local.example .env.local
```

Fill in `.env.local`:
- `MONGODB_URI` — from step 1
- `AUTH_SECRET` — run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the output
- `ADMIN_EMAILS` — the teacher's email
- `SMTP_*` — from step 2 (`SMTP_FROM_EMAIL` must be the sender you verified)

Then:

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with the admin email — the OTP arrives by email, and you land on the admin panel.

### 4. Deploy free on Vercel

1. Push this folder to a GitHub repository (private is fine — `.env.local` is gitignored, secrets never leave your machine).
2. Go to [vercel.com](https://vercel.com) → sign up with GitHub (free Hobby plan) → **Add New → Project** → import the repo.
3. Before clicking Deploy, expand **Environment Variables** and add every variable from your `.env.local` (all 9 of them).
4. Deploy. Share the `something.vercel.app` URL with students.

---

## How to use it

**Teacher:**
1. Sign in with the admin email → admin panel opens automatically.
2. **Create exam** → title + minutes.
3. **Upload the Excel sheet** (format below), check the preview, save.
4. When the class is ready, press **▶ Start exam** and tell students to open the site.
5. Watch submissions arrive live. Press **■ End exam** when time is over — anyone still writing is auto-submitted, and answers + leaderboard unlock for students.
6. Download the CSV if you want the results in Excel.

**Excel format** (first sheet, header row optional — see `sample-questions.xlsx`):

| Question | Option A | Option B | Option C | Option D | Correct | Section |
|---|---|---|---|---|---|---|
| What is 15% of 200? | 20 | 25 | 30 | 35 | C | Aptitude |
| Next in series: 2, 6, 12, 20, ? | 30 | 28 | 26 | 32 | A | Reasoning |

The **Section** column is optional — when used, students see the section name on each question and the question palette groups by section (e.g. Aptitude, Reasoning, Verbal). Keep questions of the same section together in the sheet.

**Students:**
1. Open the site → enter email → type the 6-digit code from the email.
2. Enter their full name (shown on the leaderboard) — first time only.
3. When the exam is live it appears on their dashboard → **Start exam** → fullscreen begins.
4. On submit they see their score. Once the teacher ends the exam, they can review every question and see the leaderboard.

---

## Free-tier limits (for peace of mind)

| Service | Free limit | This app's usage |
|---|---|---|
| Vercel Hobby | 100 GB bandwidth/month | A 200-student exam uses well under 1 GB |
| MongoDB Atlas M0 | 512 MB storage, free forever | Thousands of exams fit in 512 MB |
| Brevo Free | 300 emails/day | OTPs only — each student needs one rarely |

Unlike some services, the Atlas free cluster does **not** pause with inactivity (it only pauses after ~60 days of zero connections, and un-pauses itself on the next connection) — so exam day is safe.

## How the auth works (for the curious)

1. Student enters their email → the server generates a random 6-digit code, stores only its HMAC hash with a 10-minute expiry, and emails the code via Brevo.
2. Student types the code → the server checks the hash (max 5 tries, 60s resend cooldown), creates the user if new, and sets a signed **JWT session cookie** (httpOnly, 30 days).
3. Every page and API verifies that cookie server-side. Admin is whoever's email is listed in `ADMIN_EMAILS`.

## Tech stack

Next.js 16 (App Router) · MongoDB Atlas · custom email-OTP auth (jose JWT + nodemailer) · Tailwind CSS · SheetJS (Excel parsing) · deployed on Vercel.
