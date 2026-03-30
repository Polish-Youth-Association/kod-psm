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

# ─── Imports for pre-existing resources ─────────────────────────────────────

import {
  to = google_storage_bucket.certificates
  id = "member_certificates_dev"
}

import {
  to = google_artifact_registry_repository.apps
  id = "projects/psm-platform-dev/locations/us-central1/repositories/apps"
}

import {
  to = module.member_onboarding.google_service_account.app
  id = "projects/psm-platform-dev/serviceAccounts/member-onboarding-svc@psm-platform-dev.iam.gserviceaccount.com"
}

import {
  to = module.volunteer_onboarding.google_service_account.app
  id = "projects/psm-platform-dev/serviceAccounts/volunteer-onboarding-svc@psm-platform-dev.iam.gserviceaccount.com"
}

import {
  to = module.certificate_generator.google_service_account.app
  id = "projects/psm-platform-dev/serviceAccounts/certificate-generator-svc@psm-platform-dev.iam.gserviceaccount.com"
}

import {
  to = module.persist_member.google_service_account.app
  id = "projects/psm-platform-dev/serviceAccounts/persist-member-svc@psm-platform-dev.iam.gserviceaccount.com"
}

import {
  to = module.gemini.google_service_account.app
  id = "projects/psm-platform-dev/serviceAccounts/gemini-svc@psm-platform-dev.iam.gserviceaccount.com"
}

import {
  to = module.psm_portal.google_service_account.app
  id = "projects/psm-platform-dev/serviceAccounts/psm-portal-svc@psm-platform-dev.iam.gserviceaccount.com"
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
  name          = "member_certificates_dev"
  location      = "US"
  force_destroy = false

  uniform_bucket_level_access = true

  lifecycle_rule {
    action { type = "Delete" }
    condition { age = 365 }
  }
}
