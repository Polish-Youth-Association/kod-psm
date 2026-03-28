resource "google_service_account" "app" {
  project      = var.project_id
  account_id   = var.app_name
  display_name = "${var.app_name} Cloud Run service account"
}

resource "google_project_iam_member" "app_roles" {
  for_each = toset(var.roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_artifact_registry_repository" "app" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repo
  format        = "DOCKER"

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [labels]
  }
}
