import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/auth-context";
import { AuthProvider as DescopeAuthProvider } from "@descope/nextjs-sdk";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CRM Assistant",
  description:
    "AI-powered sales assistant with CRM, calendar, and document integrations",
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
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <DescopeAuthProvider
            projectId={process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID!}
          >
            <AuthProvider>{children}</AuthProvider>
          </DescopeAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import "./globals.css";
