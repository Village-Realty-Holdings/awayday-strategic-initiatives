import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { parseThemePreference, THEME_COOKIE, themeAttribute } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Link previews (Teams, Slack, Outlook) read these. The description
// deliberately carries no financial target into every pasted link.
const TITLE = "Awayday Strategic Initiatives";
const DESCRIPTION = "Awayday's strategic initiatives tracker and CIM risk register.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  applicationName: TITLE,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: TITLE, type: "website" },
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The theme preference is a presentation cookie, stamped on <html> before the
  // first paint. "system" leaves the attribute off so the CSS media query follows
  // the device. See src/lib/theme.ts.
  const preference = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="en"
      data-theme={themeAttribute(preference)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
