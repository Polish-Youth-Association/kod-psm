import { google } from "googleapis";
import { getDelegatedAccessToken } from "./workspaceAuth";

export async function getDirectoryClient() {
  const accessToken = await getDelegatedAccessToken([
    "https://www.googleapis.com/auth/admin.directory.user",
  ]);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return google.admin({ version: "directory_v1", auth });
}