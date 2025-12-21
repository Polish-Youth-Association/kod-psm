#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 4 ]; then
  echo "Usage: $0 \"app1 app2\" <project> <region> <artifact_repo>" >&2
  exit 1
fi

APPS="$1"
PROJECT="$2"
REGION="$3"
REPO="$4"

ensure_repo() {
  local repo="$1"
  if ! gcloud artifacts repositories describe "$repo" \
       --location="$REGION" \
       --project="$PROJECT" > /dev/null 2>&1; then
    echo "Repo $repo not found, creating..."
    gcloud artifacts repositories create "$repo" \
      --repository-format=docker \
      --location="$REGION" \
      --description="Shared app container repository" \
      --project="$PROJECT"
  else
    echo "Repo $repo already exists."
  fi
}

read_app_field() {
  local app_id="$1" field="$2"
  python3 - <<'PY' "$app_id" "$field"
import sys
app_id = sys.argv[1]
field = sys.argv[2]
file_path = "infra/apps.yaml"
apps = []
current = {}
with open(file_path, "r", encoding="utf-8") as fh:
    for raw in fh:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line == "apps:":
            continue
        if line.startswith("- "):
            if current.get("id"):
                apps.append(current)
            current = {}
            rest = line[2:]
            if ":" in rest:
                key, value = rest.split(":", 1)
                current[key.strip()] = value.strip().strip('"')
            continue
        if not current:
            continue
        if ":" in line:
            key, value = line.split(":", 1)
            current[key.strip()] = value.strip().strip('"')
if current.get("id"):
    apps.append(current)
for app in apps:
    if app.get("id") == app_id:
        print(app.get(field, ""))
        break
PY
}

read_manifest_service_account() {
  local manifest="$1" project="$2"
  python3 - <<'PY' "$manifest" "$project"
import sys
path, project_id = sys.argv[1:3]
service_account = ""
with open(path, "r", encoding="utf-8") as fh:
    for raw in fh:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("serviceAccount:"):
            service_account = line.split(":", 1)[1].strip()
            break
if service_account:
    print(service_account.replace("PROJECT_ID", project_id))
PY
}

ensure_secret_binding() {
  local secret_name="$1" member="$2"
  echo "Adding IAM binding for secret $secret_name -> $member"
  gcloud secrets add-iam-policy-binding "$secret_name" \
    --project="$PROJECT" \
    --member="serviceAccount:$member" \
    --role="roles/secretmanager.secretAccessor"
}

enable_required_apis() {
  echo "Enabling required APIs (idempotent)..."
  gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    --project="$PROJECT"
}

enable_required_apis
ensure_repo "$REPO"

for APP in $APPS; do
  echo "-----"
  echo "Checking infra for app: $APP"
  SECRET_NAME="app-${APP}-config"

  echo "Ensuring Secret Manager secret $SECRET_NAME exists"
  if ! gcloud secrets describe "$SECRET_NAME" --project="$PROJECT" > /dev/null 2>&1; then
    echo "{}" | gcloud secrets create "$SECRET_NAME" \
      --project="$PROJECT" \
      --data-file=- \
      --replication-policy="automatic"
  else
    echo "Secret $SECRET_NAME already exists."
  fi

  IAM_FILE=$(read_app_field "$APP" "iam_file")
  SERVICE_ACCOUNT=""
  if [ -n "$IAM_FILE" ] && [ -f "$IAM_FILE" ]; then
    SERVICE_ACCOUNT=$(read_manifest_service_account "$IAM_FILE" "$PROJECT")
  fi

  if [ -n "$SERVICE_ACCOUNT" ]; then
    echo "Ensuring service account $SERVICE_ACCOUNT exists"
    if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" --project="$PROJECT" > /dev/null 2>&1; then
      ACCOUNT_ID=$(echo "$SERVICE_ACCOUNT" | cut -d@ -f1)
      gcloud iam service-accounts create "$ACCOUNT_ID" \
        --project="$PROJECT" \
        --display-name="${APP} service account"
    fi

    echo "Ensuring Cloud Run service $APP uses $SERVICE_ACCOUNT"
    if gcloud run services describe "$APP" --region="$REGION" --project="$PROJECT" > /dev/null 2>&1; then
      CURRENT_SA=$(gcloud run services describe "$APP" --region="$REGION" --project="$PROJECT" --format="value(spec.template.spec.serviceAccountName)")
      if [ -z "$CURRENT_SA" ] || [ "$CURRENT_SA" != "$SERVICE_ACCOUNT" ]; then
        gcloud run services update "$APP" \
          --region="$REGION" \
          --project="$PROJECT" \
          --service-account="$SERVICE_ACCOUNT"
      else
        echo "$APP already uses $SERVICE_ACCOUNT"
      fi
    else
      echo "Cloud Run service $APP not found yet; will set service account on first deploy."
    fi

    ensure_secret_binding "$SECRET_NAME" "$SERVICE_ACCOUNT"
  else
    echo "No service account defined for $APP (no iam_file). Skipping SA enforcement."
  fi

done
