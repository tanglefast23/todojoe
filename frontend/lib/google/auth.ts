/**
 * Google OAuth2 authentication utilities
 * Reads credentials from file and manages token refresh
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

// File paths
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
 * Load credentials from the credentials.json file
 */
function loadCredentials(): Credentials | null {
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
 * Load saved token from token.json file
 */
function loadToken(): Token | null {
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
 * Save token to token.json file
 */
export function saveToken(token: Token): void {
  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
    console.log("Token saved to:", TOKEN_PATH);
  } catch (error) {
    console.error("Error saving token:", error);
  }
}

/**
 * Get an authenticated OAuth2 client
 * Caches the client for reuse
 */
export async function getAuthClient(): Promise<Auth.OAuth2Client | null> {
  // Return cached client if available and token is still valid
  if (cachedClient) {
    const credentials = cachedClient.credentials;
    if (credentials.expiry_date && credentials.expiry_date > Date.now() + 60000) {
      return cachedClient;
    }
  }

  const credentials = loadCredentials();
  if (!credentials) {
    return null;
  }

  const clientConfig = credentials.installed || credentials.web;
  if (!clientConfig) {
    console.error("Invalid credentials file format");
    return null;
  }

  const { client_id, client_secret, redirect_uris } = clientConfig;
  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Load saved token
  const token = loadToken();
  if (!token) {
    console.error("No token found. Please run the Google OAuth setup script first.");
    return null;
  }

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

  // Check if token needs refresh
  if (token.expiry_date && token.expiry_date < Date.now() + 60000) {
    try {
      const { credentials: refreshedCredentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(refreshedCredentials);
      if (refreshedCredentials.access_token) {
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
  const credentials = loadCredentials();
  const token = loadToken();
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
