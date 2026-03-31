variable "project_id" {
  type = string
}
variable "region" {
  type    = string
  default = "us-central1"
}

module "sa" {
  source     = "../../modules/app"
  project_id = var.project_id
  app_name   = "certificate-generator"
  roles = [
    "roles/storage.objectAdmin",
    "roles/iam.serviceAccountTokenCreator",
    "roles/secretmanager.secretAccessor",
  ]
}

module "service" {
  source     = "../../modules/cloud-run"
  project_id = var.project_id
  app_name   = "certificate-generator"
  region     = var.region
  sa_email   = module.sa.service_account_email

  env_vars = {
    GCP_PROJECT_ID  = var.project_id
    GCP_BUCKET_NAME = "member_certificates"
  }

  secrets = {
    APP_CONFIG_JSON = "app-member-onboarding-config"
  }
}
