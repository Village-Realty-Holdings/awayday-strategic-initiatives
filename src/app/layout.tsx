import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
