/**
 * Google OAuth2 Setup Script
 *
 * Run with: npx ts-node scripts/google-auth.ts
 *
 * This script:
 * 1. Reads credentials from GOOGLE_CREDENTIALS_PATH
 * 2. Opens browser for OAuth consent
 * 3. Saves token.json for persistent auth
 */

import { google, Auth } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as url from "url";
import { exec } from "child_process";

// Configuration
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || "/Volumes/Samsung SSD/Claude Code Projects/credentials.json";
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const PORT = 3001;

// Google API scopes
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

interface Credentials {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

async function main() {
  console.log("=".repeat(60));
  console.log("Google OAuth2 Setup Script");
  console.log("=".repeat(60));
  console.log();

  // Check credentials file
  console.log(`Looking for credentials at: ${CREDENTIALS_PATH}`);
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error("\n❌ Error: Credentials file not found!");
    console.error("Please ensure credentials.json exists at the specified path.");
    console.error("\nTo get credentials:");
    console.error("1. Go to https://console.cloud.google.com/apis/credentials");
    console.error("2. Create OAuth 2.0 Client ID (Desktop app)");
    console.error("3. Download and save as credentials.json");
    process.exit(1);
  }

  // Load credentials
  const credentials: Credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
  const clientConfig = credentials.installed || credentials.web;

  if (!clientConfig) {
    console.error("\n❌ Error: Invalid credentials file format!");
    process.exit(1);
  }

  const { client_id, client_secret } = clientConfig;

  // Create OAuth2 client with localhost redirect for CLI auth
  const redirectUri = `http://localhost:${PORT}/oauth2callback`;
  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent to ensure we get refresh token
  });

  console.log("\n✅ Credentials loaded successfully!");
  console.log("\nRequested scopes:");
  SCOPES.forEach((scope) => console.log(`  - ${scope.split("/").pop()}`));

  // Start local server to receive callback
  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = url.parse(req.url || "", true);

      if (reqUrl.pathname === "/oauth2callback") {
        const code = reqUrl.query.code as string;

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h1>Error: No authorization code received</h1>");
          server.close();
          process.exit(1);
        }

        // Exchange code for tokens
        console.log("\n🔄 Exchanging authorization code for tokens...");
        const { tokens } = await oauth2Client.getToken(code);

        // Save token
        const tokenData = {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_type: tokens.token_type,
          expiry_date: tokens.expiry_date,
          scope: tokens.scope,
        };

        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
        console.log(`\n✅ Token saved to: ${TOKEN_PATH}`);

        // Send success response
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Authorization Successful</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                  background: white;
                  padding: 40px;
                  border-radius: 16px;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                  text-align: center;
                  max-width: 400px;
                }
                h1 { color: #22c55e; margin-bottom: 16px; }
                p { color: #666; line-height: 1.6; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>✅ Authorization Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
                <p>The JVTodo app is now connected to your Google account.</p>
              </div>
            </body>
          </html>
        `);

        console.log("\n" + "=".repeat(60));
        console.log("🎉 Setup Complete!");
        console.log("=".repeat(60));
        console.log("\nYour JVTodo app is now connected to:");
        console.log("  - Google Calendar (read/write)");
        console.log("  - Gmail (read/modify)");
        console.log("\nYou can now start the app with: pnpm dev");

        server.close();
        process.exit(0);
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    } catch (error) {
      console.error("\n❌ Error during authentication:", error);
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end("<h1>Error during authentication</h1>");
      server.close();
      process.exit(1);
    }
  });

  server.listen(PORT, () => {
    console.log("\n" + "-".repeat(60));
    console.log("Opening browser for authorization...");
    console.log("-".repeat(60));
    console.log("\nIf the browser doesn't open automatically, visit:");
    console.log(`\n${authUrl}\n`);

    // Open browser (macOS)
    exec(`open "${authUrl}"`);
  });
}

main().catch(console.error);
