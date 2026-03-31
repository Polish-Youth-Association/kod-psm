terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  cloud {
    organization = "polish-youth-assn"
    workspaces {
      name = "psm-dev"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = "us-central1"
}

locals {
  region = "us-central1"
}

# ─── Apps ────────────────────────────────────────────────────────────────────

module "example" {
  source     = "../../apps/example"
  project_id = var.project_id
  region     = local.region
}

module "example2" {
  source      = "../../apps/example2"
  project_id  = var.project_id
  region      = local.region
  example_url = module.example.service.url
}

module "certificate_generator" {
  source     = "../../apps/certificate-generator"
  project_id = var.project_id
  region     = local.region
}

module "member_onboarding" {
  source                    = "../../apps/member-onboarding"
  project_id                = var.project_id
  region                    = local.region
  certificate_generator_url = module.certificate_generator.service.url
}

module "volunteer_onboarding" {
  source     = "../../apps/volunteer-onboarding"
  project_id = var.project_id
  region     = local.region
}

module "persist_member" {
  source     = "../../apps/persist-member"
  project_id = var.project_id
  region     = local.region
}

module "gemini" {
  source     = "../../apps/gemini"
  project_id = var.project_id
  region     = local.region
}

module "psm_portal" {
  source                   = "../../apps/psm-portal"
  project_id               = var.project_id
  region                   = local.region
  api_base_url             = module.example.service.url
  volunteer_onboarding_url = module.volunteer_onboarding.service.url
  member_onboarding_url    = module.member_onboarding.service.url
  gemini_url               = module.gemini.service.url
}

# ─── Shared infrastructure ───────────────────────────────────────────────────

resource "google_artifact_registry_repository" "apps" {
  project       = var.project_id
  location      = local.region
  repository_id = "apps"
  format        = "DOCKER"

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [labels]
  }
}

resource "google_storage_bucket" "certificates" {
  project       = var.project_id
  name          = "member_certificates_dev"
  location      = "US"
  force_destroy = false

  uniform_bucket_level_access = true

  lifecycle_rule {
    action { type = "Delete" }
    condition { age = 365 }
  }
}

