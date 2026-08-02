# Character Showdown

A classroom guessing game: the teacher picks a category, two random characters face off,
students vote for their favorite, and the teacher tries to guess who won — without seeing
either character until the votes are already locked in.

This version uses **Firebase** (real teacher accounts + realtime sync) and is meant to be
hosted on **Firebase Hosting**, with **GitHub** for source control and automatic deploys.

## 1. Create your Firebase project

1. Go to https://console.firebase.google.com and click **Add project**. Name it whatever you like.
2. Once created, click the **</>** (web) icon to register a new web app. Name it anything.
3. Copy the `firebaseConfig` values it shows you — you'll need them in step 3.
4. In the left sidebar, go to **Build → Authentication → Get started**. Enable:
   - **Email/Password** (for teachers)
   - **Anonymous** (for students — no account needed on their end)
5. In the left sidebar, go to **Build → Firestore Database → Create database**. Start in
   **production mode** (the security rules in this repo handle access control).

## 2. Install and run locally

You'll need [Node.js](https://nodejs.org) installed (version 18 or later).

```bash
npm install
cp .env.example .env
```

Open `.env` and paste in the Firebase config values from step 1.3.

```bash
npm run dev
```

This starts a local dev server (usually at `http://localhost:5173`) where you can test
everything before deploying.

## 3. Deploy to Firebase Hosting (manual, one-time)

Install the Firebase CLI if you don't have it:

```bash
npm install -g firebase-tools
firebase login
```

Link this project to your Firebase project:

```bash
cp .firebaserc.example .firebaserc
```

Edit `.firebaserc` and replace `your-firebase-project-id` with your actual Firebase project ID
(found in Firebase Console → Project Settings).

Deploy the Firestore security rules:

```bash
firebase deploy --only firestore:rules
```

Build and deploy the app:

```bash
npm run build
firebase deploy --only hosting
```

Firebase will give you a live URL like `https://your-project-id.web.app` — that's your game,
live on the internet, shareable with any teacher.

## 4. Set up GitHub + automatic deploys (optional but recommended)

1. Create a new repository on GitHub and push this code to it.
2. In Firebase Console, go to **Project Settings → Service Accounts → Generate new private key**.
   This downloads a JSON file — keep it secret, never commit it.
3. In your GitHub repo, go to **Settings → Secrets and variables → Actions** and add these
   repository secrets:
   - `FIREBASE_SERVICE_ACCOUNT` — paste the entire contents of the JSON file from step 2
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
     `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
     — the same values from your `.env` file
4. Open `.github/workflows/deploy.yml` and replace `your-firebase-project-id` with your actual
   project ID (two places: this file uses it directly since GitHub Actions secrets don't cover it).
5. Push to the `main` branch — GitHub Actions will automatically build and deploy to Firebase
   Hosting on every push.

## Updating character data

All character data lives in `src/data/characters.json`. To update it, regenerate this file
from your spreadsheet (ask Claude to do this for you, or see the format below) and replace it:

```json
{
  "Category Name": [
    { "n": "Character Name", "s": "Series Name", "a": ["Alt Name 1", "Alt Name 2"], "i": "https://image-url.jpg" }
  ]
}
```

## Notes on how the game works

- **Categories** are top-level groups (Disney Movies, Anime, Video Games, etc.). Each round
  pulls two random, not-yet-used characters from anywhere within the chosen category.
- **Voting window** is 30 seconds, but ends early automatically once every student who has
  joined the room has voted.
- **The teacher never sees the two characters until voting closes** — they see only a
  countdown. Once time's up, both characters reveal and the teacher types a guess (matched
  against the character's name and any alternate names in your spreadsheet).
- **Scores save automatically** after every round to the teacher's Firebase account, so
  nothing is lost even if a game is closed without clicking "End Game."
- This is intentionally a simple security model (any signed-in user, including anonymous
  students, can read/write any room). That's fine for a classroom tool but worth knowing if
  you plan to scale this beyond casual use.
