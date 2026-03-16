# IBKR Tracker 📈

Real-time portfolio tracker for Interactive Brokers — upload your CSV, see live prices.

## Features
- 🔐 Google Login / Email Auth (Firebase)
- 📂 Upload IBKR Activity Statement CSV
- 💹 Live prices (Yahoo Finance, 15min delay, no API key needed) 
- 📊 Positions with real-time P&L
- 📋 Trade history
- ☁️ Saved to cloud — access from anywhere

---

## Setup (20 minutes total)

### 1. Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `ibkr-tracker`
3. **Enable Authentication:**
   - Go to Build → Authentication → Get started
   - Enable **Google** provider
   - Enable **Email/Password** provider
4. **Enable Firestore:**
   - Go to Build → Firestore Database → Create database
   - Start in **production mode**
   - Choose a region (e.g., `europe-west3` for Israel)
5. **Get config:**
   - Go to Project Settings (⚙️) → Your apps → Add app → Web
   - Register app, copy the `firebaseConfig` values

### 2. Firestore Security Rules

In Firebase Console → Firestore → Rules, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 3. Environment Variables

Copy `.env.example` to `.env.local` and fill in your Firebase values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=ibkr-tracker-xxxxx.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=ibkr-tracker-xxxxx
REACT_APP_FIREBASE_STORAGE_BUCKET=ibkr-tracker-xxxxx.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 4. Run Locally

```bash
npm install
npm start
```

### 5. Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. In Vercel project settings → **Environment Variables**, add all 6 `REACT_APP_FIREBASE_*` variables
4. Deploy! 🚀

Your app will be live at `https://your-project.vercel.app`

---

## How to Export CSV from IBKR

1. Log in to IBKR Client Portal
2. Go to **Reports → Statements → Activity**
3. Set date range (e.g., last month or YTD)
4. Format: **CSV**
5. Download and upload to the app

---

## Tech Stack

- React 18
- Firebase (Auth + Firestore)
- Yahoo Finance API (free, no key, ~15min delay)
- Vercel (hosting)
- PapaParse (CSV parsing)
