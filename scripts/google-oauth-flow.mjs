#!/usr/bin/env node

import fs from "fs";
import http from "http";
import url from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Load credentials
const credentials = JSON.parse(
  fs.readFileSync(
    process.env.GOOGLE_CREDENTIALS_PATH ||
      "/Users/cc/.openclaw/media/inbound/client_secret_984898899800_g6m40gj685c3b93bngrr1g5rs6iubjiq_---8d22a639-abad-49b2-b553-c6d6e32d980f.json",
    "utf8"
  )
);

const { client_id, client_secret, auth_uri, token_uri } = credentials.installed;

const REDIRECT_URI = "http://localhost:3333/callback";

// Step 1: Generate authorization URL
const authUrl = new URL(auth_uri);
authUrl.searchParams.set("client_id", client_id);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/adwords");
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\n🔐 GOOGLE OAUTH FLOW\n");
console.log("Step 1: Click this link to authorize Claims Coach for Google Ads:\n");
console.log(`📱 ${authUrl.toString()}\n`);
console.log("Waiting for authorization...\n");

// Step 2: Create local server to receive callback
let authCode = null;

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname === "/callback") {
    authCode = parsedUrl.query.code;
    const error = parsedUrl.query.error;

    if (error) {
      res.writeHead(400);
      res.end(`❌ Authorization failed: ${error}`);
      console.log(`\n❌ Authorization failed: ${error}`);
      process.exit(1);
    }

    if (authCode) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<h1>✅ Authorization Successful!</h1><p>You can close this window.</p><p style="color: green;">Claims Coach can now access your Google Ads account.</p>`
      );

      console.log("✅ Authorization code received!\n");
      server.close();

      // Step 3: Exchange code for refresh token
      console.log("Step 2: Exchanging code for tokens...\n");

      const tokenBody = new URLSearchParams({
        code: authCode,
        client_id,
        client_secret,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      });

      try {
        const tokenRes = await fetch(token_uri, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenBody.toString(),
        });

        const tokenData = await tokenRes.json();

        if (tokenData.error) {
          console.log(`❌ Token exchange failed: ${tokenData.error_description}`);
          process.exit(1);
        }

        const refreshToken = tokenData.refresh_token;
        const accessToken = tokenData.access_token;

        console.log("✅ Token exchange successful!\n");
        console.log("Copy these to your .env.local:\n");
        console.log(`GOOGLE_OAUTH_CLIENT_ID=${client_id}`);
        console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${client_secret}`);
        console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken}`);
        console.log(`\n🔒 Access token (for testing): ${accessToken}\n`);

        // Save to .env.local
        const envPath = "/Users/cc/claims-coach-mc/.env.local";
        let envContent = fs.readFileSync(envPath, "utf8");

        envContent += `\n# Google Ads OAuth (generated ${new Date().toISOString()})\n`;
        envContent += `GOOGLE_OAUTH_CLIENT_ID=${client_id}\n`;
        envContent += `GOOGLE_OAUTH_CLIENT_SECRET=${client_secret}\n`;
        envContent += `GOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken}\n`;

        fs.writeFileSync(envPath, envContent);
        console.log(`✅ Saved to .env.local\n`);
      } catch (e) {
        console.log(`❌ Token exchange error: ${e.message}`);
        process.exit(1);
      }
    }
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(3333, () => {
  console.log("📡 Local callback server listening on http://localhost:3333\n");
});

// Timeout after 10 minutes
setTimeout(() => {
  console.log("\n⏱️ Authorization timeout (10 minutes). Exiting.");
  process.exit(1);
}, 10 * 60 * 1000);
