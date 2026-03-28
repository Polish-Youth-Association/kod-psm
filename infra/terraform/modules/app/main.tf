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

