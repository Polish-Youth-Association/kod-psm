variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "app_name" {
  description = "App name (matches the directory under apps/)"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "roles" {
  description = "IAM roles to grant to the app's service account"
  type        = list(string)
  default     = []
}

variable "artifact_repo" {
  description = "Artifact Registry repository name"
  type        = string
  default     = "apps"
}
