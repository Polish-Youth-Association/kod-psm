output "service_account_email" {
  description = "Email of the app's service account"
  value       = google_service_account.app.email
}

output "service_account_id" {
  description = "Unique ID of the app's service account"
  value       = google_service_account.app.unique_id
}
