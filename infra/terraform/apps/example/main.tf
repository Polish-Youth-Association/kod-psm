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
  app_name   = "example"
  roles      = []
}

module "service" {
  source   = "../../modules/cloud-run"
  project_id = var.project_id
  app_name   = "example"
  region     = var.region
  sa_email   = module.sa.service_account_email
}
