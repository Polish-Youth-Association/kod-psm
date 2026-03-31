variable "project_id" { type = string }
variable "region" { type = string; default = "us-central1" }
variable "example_url" { type = string }

module "sa" {
  source     = "../../modules/app"
  project_id = var.project_id
  app_name   = "example2"
  roles      = []
}

module "service" {
  source     = "../../modules/cloud-run"
  project_id = var.project_id
  app_name   = "example2"
  region     = var.region
  sa_email   = module.sa.service_account_email

  env_vars = {
    EXAMPLE_URL = var.example_url
  }
}
