variable "project_id" { type = string }
variable "region" { type = string; default = "us-central1" }

module "sa" {
  source     = "../../modules/app"
  project_id = var.project_id
  app_name   = "persist-member"
  roles = [
    "roles/datastore.user",
    "roles/secretmanager.secretAccessor",
  ]
}

module "service" {
  source     = "../../modules/cloud-run"
  project_id = var.project_id
  app_name   = "persist-member"
  region     = var.region
  sa_email   = module.sa.service_account_email

  env_vars = {
    WEBHOOK_URL = "https://manage.wix.com/_api/webhook-trigger/report/1580ea72-fd0e-4d94-b41a-874efaf43ac2/815487ae-d932-4beb-a674-aff742fb05d1"
  }

  secrets = {
    WIX_WEBHOOK_SECRET = "wix-webhook-secret"
  }
}
