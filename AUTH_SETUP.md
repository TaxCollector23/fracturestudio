# Fracture Studio authentication setup

Fracture Studio uses Firebase Authentication and Cloud Firestore so sign-in and saved work remain available when a development computer is off.

## Active services

- Email and password account creation and sign-in through Firebase Authentication.
- Password-reset emails through Firebase Authentication's built-in email sender.
- Google account sign-in through Firebase Authentication.
- Cloud-saved projects and feedback preferences in Cloud Firestore.
- Browser-local draft saving when a user is not signed in.

## No-billing configuration

The Firebase project is configured without a billing account. The default Firestore database is the project's one free-tier database. Firestore operations remain subject to Firebase's free quotas, and services requiring billing are not enabled.

## Data protection

`firestore.rules` restricts account records, projects, and preferences to their signed-in owner. Publish updated rules whenever the data model changes:

```powershell
firebase deploy --only firestore:rules
```

The current rules have already been published to the Firebase project.

## Google sign-in redirect

The Google OAuth web client must include the Firebase authentication handler as an authorized redirect URI:

```text
https://gen-lang-client-0002047847.firebaseapp.com/__/auth/handler
```

## Public browser settings

Firebase web app configuration is designed to be present in browser code. It identifies the Firebase project; it is not an administrative secret. User-data protection is provided by Authentication and Firestore Security Rules.

Optional environment overrides are documented in `.env.example`.

## Domain approval

Firebase Authentication is approved for:

- `localhost`
- `127.0.0.1`
- `fracture-studio-v1-testing-1.onrender.com`
- `fracturestudio.vercel.app`
- the two current Vercel production aliases on the connected project
- Firebase's hosting domains

Add any future custom domain to Firebase Authentication authorized domains before using login on that address.

## Password reset email

Firebase Authentication sends password-reset emails without a separate mail server. The Settings page and Studio sign-in modal both expose a `Forgot password?` action.

To change the sender name or email wording, open Firebase Console, then go to Authentication, Templates, and Password reset. Firebase's default sender works without additional setup.

## Private admin page

`/admin` lists the Firestore profiles created whenever users sign in. The server-side endpoint requires Firebase Admin credentials and never sends those credentials to the browser.

1. In Firebase Console, open Project settings, Service accounts.
2. Generate a new private key.
3. Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the complete JSON object in the server or Vercel environment.
4. Restart or redeploy.

The admin password defaults to `goatbergandrangoat`. Set `FRACTURE_ADMIN_PASSWORD` to replace it before a public launch.
