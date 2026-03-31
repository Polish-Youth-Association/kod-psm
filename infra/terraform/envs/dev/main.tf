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

# ─── Imports for pre-existing resources ──────────────────────────────────────

import {
  to = google_storage_bucket.certificates
  id = "member_certificates_dev"
}

import {
  to = google_artifact_registry_repository.apps
  id = "projects/psm-platform-dev/locations/us-central1/repositories/apps"
}

import {
  to = module.example.module.sa.google_service_account.app
  id = "projects/psm-platform-dev/serviceAccounts/example-svc@psm-platform-dev.iam.gserviceaccount.com"
}

import {
  to = module.example.module.service.google_cloud_run_v2_service.service
  id = "projects/psm-platform-dev/locations/us-central1/services/example"
}

import {
  to = module.example2.module.sa.google_service_account.app
  id = "projects/psm-platform-dev/serviceAccounts/example2-svc@psm-platform-dev.iam.gserviceaccount.com"
}

import {
  to = module.example2.module.service.google_cloud_run_v2_service.service
  id = "projects/psm-platform-dev/locations/us-central1/services/example2"
}

import {
  to = module.member_onboarding.module.sa.google_service_account.app
  id = "projects/psm-platform-dev/serviceAccounts/member-onboarding-svc@psm-platform-dev.iam.gserviceaccount.com"
}

import {
  to = module.member_onboarding.module.service.google_cloud_run_v2_service.service
  id = "projects/psm-platform-dev/locations/us-central1/services/member-onboarding"
}

import {
  to = module.volunteer_onboarding.module.sa.google_service_account.app
  id = "projects/psm-platform-dev/serviceAccounts/volunteer-onboarding-svc@psm-platform-dev.iam.gserviceaccount.com"
}

import {
  to = module.volunteer_onboarding.module.service.google_cloud_run_v2_service.service
  id = "projects/psm-platform-dev/locations/us-central1/services/volunteer-onboarding"
}

import {
  to = module.certificate_generator.module.sa.google_service_account.app
  id = "projects/psm-platform-dev/serviceAccounts/certificate-generator-svc@psm-platform-dev.iam.gserviceaccount.com"
}

import {
  to = module.certificate_generator.module.service.google_cloud_run_v2_service.service
  id = "projects/psm-platform-dev/locations/us-central1/services/certificate-generator"
}

import {
  to = module.persist_member.module.sa.google_service_account.app
  id = "projects/psm-platform-dev/serviceAccounts/persist-member-svc@psm-platform-dev.iam.gserviceaccount.com"
}

import {
  to = module.persist_member.module.service.google_cloud_run_v2_service.service
  id = "projects/psm-platform-dev/locations/us-central1/services/persist-member"
}

import {
  to = module.gemini.module.sa.google_service_account.app
  id = "projects/psm-platform-dev/serviceAccounts/gemini-svc@psm-platform-dev.iam.gserviceaccount.com"
}

import {
  to = module.gemini.module.service.google_cloud_run_v2_service.service
  id = "projects/psm-platform-dev/locations/us-central1/services/gemini"
}

import {
  to = module.psm_portal.module.sa.google_service_account.app
  id = "projects/psm-platform-dev/serviceAccounts/psm-portal-svc@psm-platform-dev.iam.gserviceaccount.com"
}

import {
  to = module.psm_portal.module.service.google_cloud_run_v2_service.service
  id = "projects/psm-platform-dev/locations/us-central1/services/psm-portal"
}
