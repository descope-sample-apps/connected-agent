import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/auth-context";
import { AuthProvider as DescopeAuthProvider } from "@descope/nextjs-sdk";
import { OAuthProvider } from "@/context/oauth-context";
import { OAuthReconnectDialog } from "@/components/oauth-reconnect-dialog";
import { TimezoneProvider } from "@/context/timezone-context";
import { initPostHog } from "@/lib/analytics";

const inter = Inter({ subsets: ["latin"] });

// Initialize PostHog on app load
initPostHog();

export const metadata: Metadata = {
  title: "ConnectedAgent",
  description:
    "AI-powered assistant with CRM, calendar, and document integrations with Descope Outbound Apps",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <DescopeAuthProvider
            projectId={process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID!}
          >
            <AuthProvider>
              <OAuthProvider>
                <TimezoneProvider>
                  {children}
                  <OAuthReconnectDialog />
                </TimezoneProvider>
              </OAuthProvider>
            </AuthProvider>
          </DescopeAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
