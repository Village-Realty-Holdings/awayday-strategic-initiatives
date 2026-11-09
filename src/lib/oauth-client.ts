"use client";

import { createAuthClient } from "better-auth/react";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

// Auth client for the MCP OAuth pages (/oauth/*) only. Its plugin attaches the
// page's signed OAuth query to each request, which is how sign-in and consent
// pick the Claude authorization back up. Kept apart from the main authClient so
// the rest of the app's sign-in requests are untouched.
export const oauthAuthClient = createAuthClient({ plugins: [oauthProviderClient()] });
