variable "project_id" { type = string }
variable "region" { type = string; default = "us-central1" }
variable "certificate_generator_url" { type = string }

module "sa" {
  source     = "../../modules/app"
  project_id = var.project_id
  app_name   = "member-onboarding"
  roles = [
    "roles/datastore.user",
    "roles/storage.objectAdmin",
    "roles/secretmanager.secretAccessor",
    "roles/run.invoker",
  ]
}

module "service" {
  source     = "../../modules/cloud-run"
  project_id = var.project_id
  app_name   = "member-onboarding"
  region     = var.region
  sa_email   = module.sa.service_account_email

  env_vars = {
    GCP_PROJECT_ID             = var.project_id
    GCP_BUCKET_NAME            = "member_certificates"
    CERTIFICATE_GENERATOR_BASE = var.certificate_generator_url
  }

  secrets = {
    WIX_INTAKE_SECRET = "wix-intake-secret"
    APP_CONFIG_JSON   = "app-member-onboarding-config"
  }
}
