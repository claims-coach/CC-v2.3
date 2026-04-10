/**
 * oauth-helper.mjs — Gmail OAuth2 client builder
 * 
 * Manages OAuth2 authentication for Gmail API access.
 * Uses cached refresh token from env vars.
 */

import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  throw new Error(
    "Missing Google OAuth env vars: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN"
  );
}

/**
 * Get an OAuth2 client with fresh access token
 */
export async function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    "http://localhost:3333/callback"
  );

  oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN,
  });

  // Refresh access token
  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);

  return oauth2Client;
}
