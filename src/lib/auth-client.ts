import { createAuthClient } from "better-auth/react";
import { twoFactorClient, adminClient, magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [twoFactorClient(), adminClient(), magicLinkClient()],
});

export const { signIn, signOut, useSession } = authClient;
