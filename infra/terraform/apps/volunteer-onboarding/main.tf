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
  app_name   = "volunteer-onboarding"
  roles = [
    "roles/secretmanager.secretAccessor",
  ]
}

module "service" {
  source     = "../../modules/cloud-run"
  project_id = var.project_id
  app_name   = "volunteer-onboarding"
  region     = var.region
  sa_email   = module.sa.service_account_email

  env_vars = {
    SLACK_DOCUSIGN_WORKFLOW_WEBHOOK_URL = "https://hooks.slack.com/triggers/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"
    SLACK_INVITE_LINK                   = "https://join.slack.com/t/polishyouth/shared_invite/zt-3puh4ox9g-HL3lsHIiTCNg7UjOgebCkA"
    ONBOARDING_FROM_EMAIL               = "michal.bienias@polishyouth.org"
    WORKSPACE_TEMP_PASSWORD_PREFIX      = "Psm!"
    DEFAULT_ORG_UNIT                    = "/Team"
    GOOGLE_SERVICE_ACCOUNT_EMAIL        = "volunteer-onboarding-svc@${var.project_id}.iam.gserviceaccount.com"
    WORKSPACE_DOMAIN                    = "polishyouth.org"
    WORKSPACE_IMPERSONATE_ADMIN         = "michal.bienias@polishyouth.org"
  }
}
