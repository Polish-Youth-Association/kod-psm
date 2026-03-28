variable "project_id" {
  description = "GCP project ID for prod environment"
  type        = string
}

variable "github_org" {
  description = "GitHub organisation (used for Workload Identity Federation)"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (used for Workload Identity Federation)"
  type        = string
}
