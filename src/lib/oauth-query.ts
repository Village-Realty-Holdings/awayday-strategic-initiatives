import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The OAuth provider's signed query from a page's search params, or null when
 * it is missing, altered or expired. A valid signature only proves the
 * parameters came from this server's /oauth2/authorize; the pages still check
 * the session, and the consent endpoint checks the client and scopes.
 */
export async function verifiedOAuthQuery(searchParams: SearchParams): Promise<URLSearchParams | null> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, v);
  }
  if (!query.has("sig")) return null;
  const { secret } = await auth.$context;
  return (await verifyOAuthQueryParams(query.toString(), secret)) ? query : null;
}
