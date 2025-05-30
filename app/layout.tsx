import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { CustomAuthProvider } from "@/context/auth-context";
import { AuthProvider } from "@descope/nextjs-sdk";
import { OAuthProvider } from "@/context/oauth-context";
import { OAuthReconnectDialog } from "@/components/oauth-reconnect-dialog";
import { TimezoneProvider } from "@/context/timezone-context";

const inter = Inter({ subsets: ["latin"] });

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
          <AuthProvider projectId={process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID!}>
            <CustomAuthProvider>
              <OAuthProvider>
                <TimezoneProvider>
                  {children}
                  <OAuthReconnectDialog />
                </TimezoneProvider>
              </OAuthProvider>
            </CustomAuthProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
