/**
 * Google OAuth2 authentication utilities
 * Supports both environment variables (for Vercel) and file-based credentials (for local dev)
 */

import { google, Auth } from "googleapis";
import * as fs from "fs";
import * as path from "path";

// Google API scopes
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

// File paths (for local development fallback)
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || "/Volumes/Samsung SSD/Claude Code Projects/credentials.json";
const TOKEN_PATH = path.join(process.cwd(), "token.json");

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

interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expiry_date: number;
  scope: string;
}

let cachedClient: Auth.OAuth2Client | null = null;

/**
 * Check if environment variables are configured for Google OAuth
 */
function hasEnvCredentials(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

/**
 * Load credentials from environment variables
 */
function loadCredentialsFromEnv(): { client_id: string; client_secret: string; redirect_uri: string } | null {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect_uri = process.env.GOOGLE_REDIRECT_URI || "http://localhost";

  if (!client_id || !client_secret) {
    return null;
  }

  return { client_id, client_secret, redirect_uri };
}

/**
 * Load token from environment variables
 */
function loadTokenFromEnv(): Token | null {
  const refresh_token = process.env.GOOGLE_REFRESH_TOKEN;

  if (!refresh_token) {
    return null;
  }

  return {
    access_token: "", // Will be refreshed
    refresh_token,
    token_type: "Bearer",
    expiry_date: 0, // Force refresh on first use
    scope: GOOGLE_SCOPES.join(" "),
  };
}

/**
 * Load credentials from the credentials.json file (local development)
 */
function loadCredentialsFromFile(): Credentials | null {
  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.error(`Credentials file not found at: ${CREDENTIALS_PATH}`);
      return null;
    }
    const content = fs.readFileSync(CREDENTIALS_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error loading credentials:", error);
    return null;
  }
}

/**
 * Load saved token from token.json file (local development)
 */
function loadTokenFromFile(): Token | null {
  try {
    if (!fs.existsSync(TOKEN_PATH)) {
      return null;
    }
    const content = fs.readFileSync(TOKEN_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error loading token:", error);
    return null;
  }
}

/**
 * Save token to token.json file (only works in local development)
 */
export function saveToken(token: Token): void {
  // Don't try to save in serverless environment
  if (hasEnvCredentials()) {
    console.log("Running in serverless mode, token refresh handled in memory");
    return;
  }

  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
    console.log("Token saved to:", TOKEN_PATH);
  } catch (error) {
    console.error("Error saving token:", error);
  }
}

/**
 * Get an authenticated OAuth2 client
 * Supports both environment variables (Vercel) and file-based credentials (local dev)
 */
export async function getAuthClient(): Promise<Auth.OAuth2Client | null> {
  // Return cached client if available and token is still valid
  if (cachedClient) {
    const credentials = cachedClient.credentials;
    if (credentials.expiry_date && credentials.expiry_date > Date.now() + 60000) {
      return cachedClient;
    }
  }

  let client_id: string;
  let client_secret: string;
  let redirect_uri: string;
  let token: Token | null;

  // Try environment variables first (for Vercel deployment)
  if (hasEnvCredentials()) {
    const envCreds = loadCredentialsFromEnv();
    if (!envCreds) {
      console.error("Failed to load credentials from environment variables");
      return null;
    }
    client_id = envCreds.client_id;
    client_secret = envCreds.client_secret;
    redirect_uri = envCreds.redirect_uri;
    token = loadTokenFromEnv();
  } else {
    // Fall back to file-based credentials (for local development)
    const fileCredentials = loadCredentialsFromFile();
    if (!fileCredentials) {
      return null;
    }

    const clientConfig = fileCredentials.installed || fileCredentials.web;
    if (!clientConfig) {
      console.error("Invalid credentials file format");
      return null;
    }

    client_id = clientConfig.client_id;
    client_secret = clientConfig.client_secret;
    redirect_uri = clientConfig.redirect_uris[0];
    token = loadTokenFromFile();
  }

  if (!token) {
    console.error("No token found. Please run the Google OAuth setup script first or set GOOGLE_REFRESH_TOKEN env var.");
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uri
  );

  oauth2Client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_type: token.token_type,
    expiry_date: token.expiry_date,
  });

  // Set up automatic token refresh
  oauth2Client.on("tokens", (newTokens) => {
    if (newTokens.refresh_token) {
      saveToken({
        ...token,
        ...newTokens,
        expiry_date: newTokens.expiry_date || Date.now() + 3600000,
      } as Token);
    }
  });

  // Check if token needs refresh (always refresh if using env vars since access_token is empty)
  if (!token.access_token || (token.expiry_date && token.expiry_date < Date.now() + 60000)) {
    try {
      const { credentials: refreshedCredentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(refreshedCredentials);
      if (refreshedCredentials.access_token && !hasEnvCredentials()) {
        saveToken({
          ...token,
          access_token: refreshedCredentials.access_token,
          expiry_date: refreshedCredentials.expiry_date || Date.now() + 3600000,
        });
      }
    } catch (error) {
      console.error("Error refreshing token:", error);
      return null;
    }
  }

  cachedClient = oauth2Client;
  return oauth2Client;
}

/**
 * Check if Google API is configured and authenticated
 */
export function isGoogleConfigured(): boolean {
  // Check environment variables first
  if (hasEnvCredentials()) {
    return true;
  }

  // Fall back to file-based check
  const credentials = loadCredentialsFromFile();
  const token = loadTokenFromFile();
  return credentials !== null && token !== null;
}

/**
 * Get the path to the credentials file
 */
export function getCredentialsPath(): string {
  return CREDENTIALS_PATH;
}

/**
 * Get the path to the token file
 */
export function getTokenPath(): string {
  return TOKEN_PATH;
}
