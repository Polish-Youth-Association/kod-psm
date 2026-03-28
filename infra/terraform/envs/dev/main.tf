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

# ─── Firestore (Native mode) ─────────────────────────────────────────────────

resource "google_firestore_database" "members" {
  project     = var.project_id
  name        = "members"
  location_id = "us-central1"
  type        = "FIRESTORE_NATIVE"
}

# ─── Workload Identity Federation (GitHub Actions → GCP) ────────────────────

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions pool"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub OIDC provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == '${var.github_org}/${var.github_repo}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

