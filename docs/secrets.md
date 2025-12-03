
# App Secrets

Apps for PSM Apps in the `kod-psm` repository are stored in the GCP Secrets manager associated with the App


### Local Secret Testing

If you wish to test locally and need to declare secrets for local testing, use a app level `.env` file. You can declare your secrets as follows:

```
SECRET_1=secret_value
PORT=465
USER=test.user
```
DO NOT MERGE .ENV FILES

### Updating App Secrets

    1. Go to the PSM managed GCP Account
    2. Open Secrets Manger Resource
    3. Find desired app secrets you want to update
    4. Use JSON format to declare and save new secrets 

    JSON Format:
    {
        "SECRET_1": "secret_value",
        "PORT": "465",
        "SER": "test.user"
    }

Be Safe!