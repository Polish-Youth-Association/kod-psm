variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "app_name" {
  description = "Cloud Run service name"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "sa_email" {
  description = "Service account email to run the service as"
  type        = string
}

variable "image" {
  description = "Initial container image (CI will update this on each deploy)"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "env_vars" {
  description = "Environment variables to set on the container"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Secret Manager secrets to mount as env vars. Map of env var name to secret name."
  type        = map(string)
  default     = {}
}

variable "memory" {
  description = "Memory limit"
  type        = string
  default     = "512Mi"
}

variable "cpu" {
  description = "CPU limit"
  type        = string
  default     = "1000m"
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 20
}

variable "concurrency" {
  description = "Maximum concurrent requests per instance"
  type        = number
  default     = 80
}

variable "timeout_seconds" {
  description = "Request timeout in seconds"
  type        = number
  default     = 300
}

variable "allow_domain_invokers" {
  description = "Allow polishyouth.org domain members to invoke the service"
  type        = bool
  default     = true
}

variable "annotations" {
  description = "Annotations to set on the Cloud Run service"
  type        = map(string)
  default     = {}
}
