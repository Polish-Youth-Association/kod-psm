# App IAM manifests

Each deployable app can describe the Google Cloud IAM bindings it needs in an `iam.yaml` file that lives beside its source (for example `apps/example/iam.yaml`). These manifests let us:

- keep IAM requirements version-controlled with the code
- review new permissions through normal PRs
- give the deploy pipeline a deterministic list of bindings to enforce

## File format

```yaml
# apps/<app>/iam.yaml
serviceAccount: projects/<project>/serviceAccounts/<sa-name>@<project>.iam.gserviceaccount.com
roles:
  # project-level bindings
  - roles/run.invoker
  - roles/storage.objectViewer

# optional resource-scoped bindings
resources:
  - type: storage.bucket
    name: gs://<bucket-name>
    roles:
      - roles/storage.objectViewer
```

### Fields

| Field | Required | Description |
| ----- | -------- | ----------- |
| `serviceAccount` | ✅ | Target principal (usually the deployed Cloud Run service account). |
| `roles` | ✅ | Project-level roles to bind to the service account. |
| `resources` | Optional | List of resource-specific bindings. Each item needs a `type`, `name`, and `roles`. The meaning of `name` depends on the resource type (for example `gs://bucket-name` for Cloud Storage buckets). |

## How it is used

1. The `infra/apps.yaml` file can optionally reference each app's IAM manifest through an `iam_file` field.  
2. Deployment tooling (GitHub Actions, Cloud Build, etc.) reads the manifest, ensures the service account exists, and applies the specified roles using `gcloud` or Terraform.  
3. Changes to IAM now flow through standard reviews just like code changes.

> Note: the repo does not yet include the automation that applies these manifests. This document only specifies the format so that tooling can be wired up separately.
