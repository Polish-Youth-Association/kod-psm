variable "project_id" { type = string }
variable "region" { type = string; default = "us-central1" }
variable "api_base_url" { type = string }
variable "volunteer_onboarding_url" { type = string }
variable "member_onboarding_url" { type = string }
variable "gemini_url" { type = string }

module "sa" {
  source     = "../../modules/app"
  project_id = var.project_id
  app_name   = "psm-portal"
  roles = [
    "roles/run.invoker",
    "roles/secretmanager.secretAccessor",
  ]
}

module "service" {
  source     = "../../modules/cloud-run"
  project_id = var.project_id
  app_name   = "psm-portal"
  region     = var.region
  sa_email   = module.sa.service_account_email

  env_vars = {
    API_BASE                = var.api_base_url
    VOLUNTEER_ONBOARDING_BASE = var.volunteer_onboarding_url
    MEMBER_ONBOARDING_BASE  = var.member_onboarding_url
    GEMINI_BASE             = var.gemini_url
  }
}
