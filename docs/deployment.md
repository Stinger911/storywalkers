# Deployment

This monorepo deploys the frontend to Firebase Hosting and the backend to Cloud Run.

## Prereqs

- Firebase CLI (`firebase`)
- Google Cloud SDK (`gcloud`)
- Project with Firebase Auth + Firestore enabled

## Frontend (Firebase Hosting)

Config: `firebase/firebase.json`

Build:

```bash
npm ci --prefix frontend
npm run --prefix frontend build
```

Deploy:

```bash
firebase deploy --project <PROJECT_ID> --only hosting,firestore:rules --config firebase/firebase.json
```

Notes:
- Hosting rewrites `/api/**` to the Cloud Run service (`storywalkers-api` in `us-central1`).
- If you do not want Hosting rewrites, set `VITE_API_BASE` to the Cloud Run URL at build time.

## Backend (Cloud Run)

Config template: `backend/cloudrun.yaml`

Required env vars:
- `FIREBASE_PROJECT_ID` (matches your Firebase project)
- `AUTH_REQUIRED=true`
- `ENV=production`

Build + deploy with Cloud Build:

```bash
gcloud builds submit backend --project <PROJECT_ID> --tag gcr.io/<PROJECT_ID>/storywalkers-api:latest
gcloud run deploy storywalkers-api \
  --project <PROJECT_ID> \
  --region us-central1 \
  --image gcr.io/<PROJECT_ID>/storywalkers-api:latest \
  --allow-unauthenticated \
  --set-env-vars ENV=production,AUTH_REQUIRED=true,FIREBASE_PROJECT_ID=<PROJECT_ID>
```

Notes:
- Cloud Run service account must have permissions for Firebase Auth + Firestore.
- Firestore uses database `pathways` when `FIREBASE_PROJECT_ID` is set.

## CI-ready scripts

These scripts are safe to call from CI and expect environment variables:

- `scripts/ci/build-frontend.sh`
- `scripts/ci/build-backend.sh` (`IMAGE_TAG` optional)
- `scripts/ci/deploy-frontend.sh` (`FIREBASE_PROJECT_ID` required)
- `scripts/ci/deploy-backend.sh` (`PROJECT_ID`, `CLOUD_RUN_SERVICE`, `CLOUD_RUN_REGION` required)
