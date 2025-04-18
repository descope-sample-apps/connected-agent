"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  FileText,
  Book,
  ArrowRight,
  Calendar,
  CheckCircle,
} from "lucide-react";
import React, { useRef } from "react";
import { cn } from "@/lib/utils";
import AnimatedBeamComponent from "@/components/animated-beam";

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to chat page
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/chat");
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="border-b bg-white dark:bg-gray-900 px-6 py-4 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          ConnectedAgent
        </h1>

        <div className="flex items-center gap-3">
          <a
            href="https://docs.descope.com/outbound/"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground hover:text-indigo-500 transition-colors duration-200 flex items-center gap-1"
          >
            <FileText className="h-4 w-4" />
            <span>Docs</span>
          </a>
          <a
            href="https://github.com/descope"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground hover:text-indigo-500 transition-colors duration-200 flex items-center gap-1"
          >
            <Book className="h-4 w-4" />
            <span>GitHub</span>
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 md:py-20">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Connected Agent Platform
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            A powerful platform that connects your applications with Descope SDK
            for seamless authentication and user management.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/login">
              <Button
                size="lg"
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-8 py-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
              >
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a
              href="https://docs.descope.com/outbound/guides/outboundappflow/"
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="outline"
                size="lg"
                className="px-6 py-6 rounded-xl border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
              >
                Outbound Apps Docs <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Connections Animation Section */}
      <div className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Connect to Popular Services
          </h2>
          <p className="text-xl text-muted-foreground text-center mb-8 max-w-3xl mx-auto">
            Descope enables secure connections to dozens of popular services
            through OAuth, without storing credentials
          </p>

          <div className="relative max-w-4xl mx-auto h-[400px]">
            <AnimatedBeamComponent />
          </div>

          <p className="text-center text-muted-foreground mt-4 mb-6 max-w-3xl mx-auto">
            Securely connect your AI assistant to popular services with
            Descope's OAuth integration. No credentials are stored in your
            application.
          </p>

          {/* Service icons row - simplified */}
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            <div className="flex items-center bg-white dark:bg-gray-800 py-2 px-4 rounded-full shadow-sm border border-gray-100 dark:border-gray-700">
              <span className="text-sm font-medium">
                Connect to 40+ Popular Services
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Features Section */}
      <div className="py-16 md:py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Powerful Connection Capabilities
          </h2>
          <p className="text-xl text-muted-foreground text-center mb-16 max-w-3xl mx-auto">
            Build AI agents that seamlessly connect to the tools your users
            already love
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-6">
                <Image
                  src="/logos/google-calendar.png"
                  alt="Calendar"
                  width={32}
                  height={32}
                />
              </div>
              <h3 className="text-xl font-semibold mb-4">
                Google Calendar Integration
              </h3>
              <p className="text-muted-foreground">
                Allow your AI to check availability, schedule meetings, and
                create events directly in your users' calendars.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-6">
                <Image
                  src="/logos/google-meet-logo.png"
                  alt="Meet"
                  width={32}
                  height={32}
                />
              </div>
              <h3 className="text-xl font-semibold mb-4">Google Meet Access</h3>
              <p className="text-muted-foreground">
                Create and join video meetings with a single command, with
                secure links generated directly from your chat interface.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-6">
                <Image
                  src="/logos/crm-logo.png"
                  alt="CRM"
                  width={32}
                  height={32}
                />
              </div>
              <h3 className="text-xl font-semibold mb-4">
                CRM System Integration
              </h3>
              <p className="text-muted-foreground">
                Access customer data, update deals, and manage contacts without
                ever leaving your AI assistant's interface.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            How It Works
          </h2>
          <div className="space-y-16 md:space-y-24">
            {/* Feature 1 */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="p-8 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
                  <span className="text-3xl text-indigo-600 dark:text-indigo-400">
                    1
                  </span>
                </div>
                <h3 className="text-2xl font-semibold mb-4">
                  Setup Outbound Applications in Descope
                </h3>
                <p className="text-muted-foreground text-lg">
                  Setup outbound applications in Descope to connect your agent
                  to any of the dozens of pre-defined applications.
                </p>
              </div>
              <div className="relative h-[400px] bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800">
                <Image
                  src="/images/outbound-apps.png"
                  alt="Setup outbound apps"
                  fill
                  className="object-cover"
                />
              </div>
            </div>

            {/* Feature 2 */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="relative h-[400px] bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 order-2 md:order-1">
                <Image
                  src="/images/dashboard-config.png"
                  alt="Dashboard Configuration"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-8 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-800 order-1 md:order-2">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
                  <span className="text-3xl text-indigo-600 dark:text-indigo-400">
                    2
                  </span>
                </div>
                <h3 className="text-2xl font-semibold mb-4">
                  Design and Build Your Tools
                </h3>
                <p className="text-muted-foreground text-lg">
                  Design your tools using the sample code in this application.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="p-8 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
                  <span className="text-3xl text-indigo-600 dark:text-indigo-400">
                    3
                  </span>
                </div>
                <h3 className="text-2xl font-semibold mb-4">
                  Fetch Token for Tools with Descope SDK
                </h3>
                <p className="text-muted-foreground text-lg">
                  Use Descope SDK to fetch the token and connect to
                  applications.
                </p>
              </div>
              <div className="relative h-[400px] bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800">
                <Image
                  src="/images/user-management.png"
                  alt="User Management"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Details */}
      <div className="py-16 md:py-20 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Descope SDK Integration
          </h2>
          <p className="text-xl text-muted-foreground text-center mb-12 max-w-3xl mx-auto">
            Seamlessly integrate secure OAuth connections into your AI
            applications
          </p>
          <div className="max-w-6xl mx-auto">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm mb-12 border border-gray-100 dark:border-gray-800">
              <h3 className="text-2xl font-semibold mb-6">Key Features</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="bg-green-100 dark:bg-green-900/30 p-1 rounded-full mr-3">
                    <svg
                      className="h-4 w-4 text-green-600 dark:text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                  <span className="text-lg text-muted-foreground">
                    Secure token storage for all your connected services
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="bg-green-100 dark:bg-green-900/30 p-1 rounded-full mr-3">
                    <svg
                      className="h-4 w-4 text-green-600 dark:text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                  <span className="text-lg text-muted-foreground">
                    User and tenant-based token management
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="bg-green-100 dark:bg-green-900/30 p-1 rounded-full mr-3">
                    <svg
                      className="h-4 w-4 text-green-600 dark:text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                  <span className="text-lg text-muted-foreground">
                    Multiple tokens supported for each user (for scoped access)
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="bg-green-100 dark:bg-green-900/30 p-1 rounded-full mr-3">
                    <svg
                      className="h-4 w-4 text-green-600 dark:text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                  <span className="text-lg text-muted-foreground">
                    Easy to use SDKs that intergate with existing and MCP tools
                  </span>
                </li>
              </ul>
            </div>

            {/* Enhanced Code Example Section */}
            <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 py-3 px-5">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    Token Access Example
                  </h3>
                </div>
                <div className="p-5">
                  <p className="text-muted-foreground mb-4">
                    Use a generic tool with outbound app functions to securely
                    access provider tokens:
                  </p>
                  <div className="bg-gray-950 text-gray-100 rounded-lg p-5 overflow-x-auto shadow-inner border border-gray-800">
                    <pre className="text-sm font-mono leading-relaxed whitespace-pre">
                      <code>
                        {`export class OAuthTool extends Tool {
  config() {
    return {
      name: "oauth_tool",
      description: "Access external services securely",
      inputSchema: {
        provider: {
          type: "string",
          description: "Provider name (google, slack, etc.)",
        },
        scopes: {
          type: "array",
          description: "Required OAuth scopes",
        }
      }
    };
  }

  async execute({ provider, scopes }) {
    try {
      // Get token using Descope SDK
      const token = await getOAuthToken({
        appId: provider,
        scopes: scopes
      });
      
      // Make API calls using the token
      const response = await fetch(
        \`https://api.\${provider}.com/endpoint\`,
        {
          headers: {
            Authorization: \`Bearer \${token}\`
          }
        }
      );
      
      return await response.json();
    } catch (error) {
      throw new Error(\`OAuth error: \${error.message}\`);
    }
  }
}`}
                      </code>
                    </pre>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 py-3 px-5">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    Usage in AI Functions
                  </h3>
                </div>
                <div className="p-5">
                  <p className="text-muted-foreground mb-4">
                    Integrate with AI function calling to enable seamless access
                    to external services:
                  </p>
                  <div className="bg-gray-950 text-gray-100 rounded-lg p-5 overflow-x-auto shadow-inner border border-gray-800">
                    <pre className="text-sm font-mono leading-relaxed whitespace-pre">
                      <code>
                        {`// Example AI function call
const functionDefinition = {
  name: "access_google_calendar",
  description: "Access Google Calendar events",
  parameters: {
    type: "object",
    properties: {
      provider: {
        type: "string",
        enum: ["google-calendar"]
      },
      scopes: {
        type: "array",
        items: {
          type: "string"
        }
      }
    },
    required: ["provider", "scopes"]
  }
};

// AI function implementation
async function accessGoogleCalendar(params) {
  try {
    // Get OAuth token through Descope
    const token = await getOAuthToken({
      appId: params.provider,
      scopes: params.scopes
    });
    
    // Use token to fetch calendar data
    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        headers: {
          Authorization: \`Bearer \${token}\`
        }
      }
    );
    
    return await response.json();
  } catch (error) {
    // Handle connection needed case
    if (error.code === "token_not_found") {
      return {
        needsConnection: true,
        provider: params.provider
      };
    }
    throw error;
  }
}`}
                      </code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
              <h3 className="text-2xl font-semibold mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                Integration Steps
              </h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="flex flex-col p-6 border border-gray-100 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4 shrink-0">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      1
                    </span>
                  </div>
                  <h4 className="font-semibold text-lg mb-2">
                    Configure Outbound App
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    Setup your chosen service (Google, Slack, CRM) in the
                    Descope Console and configure OAuth settings
                  </p>
                </div>

                <div className="flex flex-col p-6 border border-gray-100 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4 shrink-0">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      2
                    </span>
                  </div>
                  <h4 className="font-semibold text-lg mb-2">
                    Implement Connection UI
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    Add connection buttons that trigger OAuth flows when a user
                    needs to connect to a service
                  </p>
                </div>

                <div className="flex flex-col p-6 border border-gray-100 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4 shrink-0">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      3
                    </span>
                  </div>
                  <h4 className="font-semibold text-lg mb-2">
                    Fetch & Use Token
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    Use Descope SDK to securely obtain tokens for the connected
                    services and make API calls
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-950/50 dark:to-purple-950/50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Ready to Build Powerful Connected Experiences?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Join lots of developers who are creating AI agents with secure
            access to external tools and services.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="https://descope.com/sign-up">
              <Button
                size="lg"
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-6 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-8">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-muted-foreground">Free Forever Tier</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-muted-foreground">
                Unlimited App Connections
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-muted-foreground">Full API Access</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-muted-foreground">Technical Support</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            Powered by Descope AI
          </p>
          <div className="flex items-center justify-center space-x-4 w-full mt-2">
            <a
              href="https://www.descope.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline transition-colors duration-200"
            >
              Privacy Policy
            </a>
            <span className="text-xs text-muted-foreground">•</span>
            <a
              href="https://www.descope.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline transition-colors duration-200"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
