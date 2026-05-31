# Fracture Studio authentication setup

Fracture Studio uses Firebase Authentication and Cloud Firestore so sign-in and saved work remain available when a development computer is off.

## Active services

- Email and password account creation and sign-in through Firebase Authentication.
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

Keep any local development redirect already used by older PocketBase testing only if that test environment is still needed.

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
