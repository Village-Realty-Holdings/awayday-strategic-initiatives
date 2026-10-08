import { isMicrosoftSsoEnabled } from "@/lib/sso";
import { authErrorText } from "@/lib/auth-error-text";
import { LoginForm } from "./login-form";

// Server shell: decides once, from the environment, whether the Microsoft
// button is offered. The form itself is a client component (login-form.tsx).
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <LoginForm ssoEnabled={isMicrosoftSsoEnabled(process.env)} initialError={authErrorText(error)} />;
}
