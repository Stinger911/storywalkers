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
- `scripts/ci/deploy-frontend-dev.sh` (`FIREBASE_PROJECT_ID` required, `FIREBASE_HOSTING_CHANNEL` optional; defaults to `dev`, `FIREBASE_HOSTING_TARGET` optional for multi-site)
- `scripts/ci/deploy-backend-dev.sh` (`PROJECT_ID` required; defaults: `CLOUD_RUN_SERVICE=storywalkers-api-dev`, `CLOUD_RUN_REGION=europe-west1`)

## Dev Environment Deploy

Cloud Run service:
- `storywalkers-api-dev`

Firebase Hosting:
- Preview channel `dev` (via `firebase hosting:channel:deploy`)
- Config: `firebase/firebase.dev.json` (rewrites `/api/**` to `storywalkers-api-dev`)

## GitHub Actions (Workload Identity Federation)

This repo ships a release workflow that deploys on tags `v*` and uses Workload
Identity Federation (WIF). You must create a WIF provider, a service account,
and grant permissions.

### 1) Create a service account

```bash
gcloud iam service-accounts create storywalkers-deployer \
  --project <PROJECT_ID> \
  --display-name "StoryWalkers GitHub Actions"
```

### 2) Create WIF pool + provider

```bash
gcloud iam workload-identity-pools create github-actions \
  --project <PROJECT_ID> \
  --location "global" \
  --display-name "GitHub Actions Pool"

gcloud iam workload-identity-pools providers create-oidc github-actions \
  --project <PROJECT_ID> \
  --location "global" \
  --workload-identity-pool "github-actions" \
  --display-name "GitHub Actions Provider" \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref"
```

### 3) Bind the service account to the repo

```bash
gcloud iam service-accounts add-iam-policy-binding \
  "storywalkers-deployer@<PROJECT_ID>.iam.gserviceaccount.com" \
  --project <PROJECT_ID> \
  --role "roles/iam.workloadIdentityUser" \
  --member "principalSet://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-actions/attribute.repository/<OWNER>/<REPO>"
```

### 4) Grant required permissions

This workflow uses Cloud Build + Cloud Run + Firebase Hosting deploy. Grant the
service account these roles (adjust if you have stricter policies):

```bash
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member "serviceAccount:storywalkers-deployer@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role "roles/run.admin"

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member "serviceAccount:storywalkers-deployer@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role "roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member "serviceAccount:storywalkers-deployer@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role "roles/storage.admin"

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member "serviceAccount:storywalkers-deployer@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role "roles/firebase.admin"
```

If you prefer Firebase Hosting only (no rules deploy), you can replace
`roles/firebase.admin` with a narrower Firebase Hosting role.

### 5) GitHub secrets

Set the following GitHub Actions secrets:

- `GCP_WIF_PROVIDER`: full provider resource name, e.g.
  `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-actions/providers/github-actions`
- `GCP_WIF_SERVICE_ACCOUNT`: service account email, e.g.
  `storywalkers-deployer@<PROJECT_ID>.iam.gserviceaccount.com`
- `PROJECT_ID`: GCP project id
- `FIREBASE_PROJECT_ID`: Firebase project id (same as `PROJECT_ID`)
- `CLOUD_RUN_SERVICE`: Cloud Run service name
- `CLOUD_RUN_REGION`: Cloud Run region
