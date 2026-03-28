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
      name = "psm-prod"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = "us-central1"
}

# ─── App service accounts + IAM ─────────────────────────────────────────────

module "member_onboarding" {
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

module "volunteer_onboarding" {
  source     = "../../modules/app"
  project_id = var.project_id
  app_name   = "volunteer-onboarding"
  roles = [
    "roles/secretmanager.secretAccessor",
  ]
}

module "certificate_generator" {
  source     = "../../modules/app"
  project_id = var.project_id
  app_name   = "certificate-generator"
  roles = [
    "roles/storage.objectAdmin",
    "roles/iam.serviceAccountTokenCreator",
    "roles/secretmanager.secretAccessor",
  ]
}

module "persist_member" {
  source     = "../../modules/app"
  project_id = var.project_id
  app_name   = "persist-member"
  roles = [
    "roles/datastore.user",
    "roles/secretmanager.secretAccessor",
  ]
}

module "gemini" {
  source     = "../../modules/app"
  project_id = var.project_id
  app_name   = "gemini"
  roles = [
    "roles/secretmanager.secretAccessor",
  ]
}

module "psm_portal" {
  source     = "../../modules/app"
  project_id = var.project_id
  app_name   = "psm-portal"
  roles = [
    "roles/run.invoker",
    "roles/secretmanager.secretAccessor",
  ]
}

# ─── Shared Artifact Registry repo ──────────────────────────────────────────
# One repo named "apps" holds images for all services.

resource "google_artifact_registry_repository" "apps" {
  project       = var.project_id
  location      = "us-central1"
  repository_id = "apps"
  format        = "DOCKER"

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [labels]
  }
}

# ─── GCS bucket for certificates ────────────────────────────────────────────

resource "google_storage_bucket" "certificates" {
  project       = var.project_id
  name          = "member_certificates"
  location      = "US"
  force_destroy = false

  uniform_bucket_level_access = true

  lifecycle_rule {
    action { type = "Delete" }
    condition { age = 730 }
  }
}
