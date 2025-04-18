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
  CheckCircle,
} from "lucide-react";
import React from "react";
import AnimatedBeamComponent from "@/components/animated-beam";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="border-b bg-white dark:bg-gray-900 px-6 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          ConnectedAgent
        </h1>

        <div className="flex items-center gap-3">
          <a
            href="https://docs.descope.com/outbound-apps"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground hover:text-indigo-500 transition-colors duration-200 flex items-center gap-1"
          >
            <FileText className="h-4 w-4" />
            <span>Docs</span>
          </a>
          <a
            href="https://github.com/descope-sample-apps/connected-agent"
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
      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-8 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent leading-tight pb-2">
            ConnectedAgent Sample App
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
            A powerful AI chatbot that uses Descope Outbound Apps for seamless
            connections to your AI tools.
          </p>

          <div className="mb-8">
            <AnimatedBeamComponent />
            <p className="text-center text-muted-foreground mt-2 max-w-xl mx-auto text-sm md:text-base">
              Connect your AI assistant to dozens of services securely with just
              a few lines of code
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/login">
              <Button
                size="lg"
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-8 py-5 rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
              >
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a
              href="https://docs.descope.com/outbound-apps"
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="outline"
                size="lg"
                className="px-6 py-5 rounded-xl border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
              >
                Outbound Apps Docs <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Key Features Section */}
      <div className="py-12 md:py-16 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Powerful Connection Capabilities
          </h2>
          <p className="text-xl text-muted-foreground text-center mb-12 max-w-3xl mx-auto">
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
      <div className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-10 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            How It Works
          </h2>
          <div className="space-y-16 md:space-y-20">
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
                  src="/images/app-connect.png"
                  alt="Application Connect"
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
                  Connect to Your Outbound Apps
                </h3>
                <p className="text-muted-foreground text-lg">
                  Connect via OAuth to your Outbound Apps for Descope to manage
                  the tokens.
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
                  In your tool calls, use the Descope SDK to fetch the token and
                  connect to applications.
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

      {/* Integration Details - improved styling */}
      <div className="py-16 md:py-20 bg-gradient-to-br from-indigo-50/70 to-purple-50/70 dark:from-indigo-950/30 dark:to-purple-950/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent inline-block">
              Descope SDK Integration
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full mt-2 mb-4"></div>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Seamlessly integrate secure OAuth connections into your AI
              applications
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
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

            <div className="space-y-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-5 py-3 flex items-center">
                  <div className="flex space-x-2 mr-3">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Example Usage with AI Function Calling
                  </h3>
                </div>
                <div className="px-5 py-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Integrate with function calling to enable seamless access to
                    external services:
                  </p>
                  <div className="bg-gray-950 text-gray-100 rounded-lg overflow-x-auto shadow-inner border border-gray-800">
                    <pre
                      className="p-4 text-sm font-mono leading-relaxed"
                      style={{ minWidth: "800px", maxWidth: "100%" }}
                    >
                      <code className="language-javascript whitespace-pre-wrap break-all">
                        <span className="text-purple-400">const</span>{" "}
                        <span className="text-blue-400">
                          functionDefinition
                        </span>{" "}
                        <span className="text-white">=</span>{" "}
                        <span className="text-white">{"{"}</span>
                        <br />
                        &nbsp;&nbsp;<span className="text-green-400">name</span>
                        <span className="text-white">:</span>{" "}
                        <span className="text-orange-400">
                          "access_google_calendar"
                        </span>
                        <span className="text-white">,</span>
                        <br />
                        &nbsp;&nbsp;
                        <span className="text-green-400">description</span>
                        <span className="text-white">:</span>{" "}
                        <span className="text-orange-400">
                          "Access Google Calendar events"
                        </span>
                        <span className="text-white">,</span>
                        <br />
                        &nbsp;&nbsp;
                        <span className="text-green-400">parameters</span>
                        <span className="text-white">: {"{"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">type</span>
                        <span className="text-white">:</span>{" "}
                        <span className="text-orange-400">"object"</span>
                        <span className="text-white">,</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">properties</span>
                        <span className="text-white">: {"{"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">provider</span>
                        <span className="text-white">: {"{"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">type</span>
                        <span className="text-white">:</span>{" "}
                        <span className="text-orange-400">"string"</span>
                        <span className="text-white">,</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">enum</span>
                        <span className="text-white">: [</span>
                        <span className="text-orange-400">
                          "google-calendar"
                        </span>
                        <span className="text-white">]</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-white">{"}"}</span>
                        <span className="text-white">,</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">scopes</span>
                        <span className="text-white">: {"{"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">type</span>
                        <span className="text-white">:</span>{" "}
                        <span className="text-orange-400">"array"</span>
                        <span className="text-white">,</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">items</span>
                        <span className="text-white">: {"{"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">type</span>
                        <span className="text-white">:</span>{" "}
                        <span className="text-orange-400">"string"</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-white">{"}"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-white">{"}"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-white">{"}"}</span>
                        <span className="text-white">,</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">required</span>
                        <span className="text-white">: [</span>
                        <span className="text-orange-400">"provider"</span>
                        <span className="text-white">,</span>{" "}
                        <span className="text-orange-400">"scopes"</span>
                        <span className="text-white">]</span>
                        <br />
                        &nbsp;&nbsp;<span className="text-white">{"}"}</span>
                        <br />
                        <span className="text-white">{"}"}</span>
                        <span className="text-white">;</span>
                        <br />
                        <br />
                        <span className="text-purple-400">async</span>{" "}
                        <span className="text-purple-400">function</span>{" "}
                        <span className="text-yellow-400">
                          accessGoogleCalendar
                        </span>
                        <span className="text-white">(</span>
                        <span className="text-blue-400">params</span>
                        <span className="text-white">) {"{"}</span>
                        <br />
                        &nbsp;&nbsp;<span className="text-purple-400">
                          try
                        </span>{" "}
                        <span className="text-white">{"{"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-gray-400">
                          // Get OAuth token through Descope
                        </span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-purple-400">const</span>{" "}
                        <span className="text-blue-400">token</span>{" "}
                        <span className="text-white">=</span>{" "}
                        <span className="text-purple-400">await</span>{" "}
                        <span className="text-yellow-400">getOAuthToken</span>
                        <span className="text-white">(</span>
                        <span className="text-white">{"{"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">appId</span>
                        <span className="text-white">:</span>{" "}
                        <span className="text-blue-400">params</span>
                        <span className="text-white">.</span>
                        <span className="text-green-400">provider</span>
                        <span className="text-white">,</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">scopes</span>
                        <span className="text-white">:</span>{" "}
                        <span className="text-blue-400">params</span>
                        <span className="text-white">.</span>
                        <span className="text-green-400">scopes</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-white">{"}"}</span>
                        <span className="text-white">)</span>
                        <span className="text-white">;</span>
                        <br />
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-gray-400">
                          // Use token to fetch calendar data
                        </span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-purple-400">const</span>{" "}
                        <span className="text-blue-400">response</span>{" "}
                        <span className="text-white">=</span>{" "}
                        <span className="text-purple-400">await</span>{" "}
                        <span className="text-yellow-400">fetch</span>
                        <span className="text-white">(</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-orange-400">
                          "https://www.googleapis.com/calendar/v3/calendars/primary/events"
                        </span>
                        <span className="text-white">,</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-white">{"{"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">headers</span>
                        <span className="text-white">: {"{"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">Authorization</span>
                        <span className="text-white">:</span>{" "}
                        <span className="text-orange-400">
                          {"`Bearer ${token}`"}
                        </span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-white">{"}"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-white">{"}"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-white">)</span>
                        <span className="text-white">;</span>
                        <br />
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-purple-400">return</span>{" "}
                        <span className="text-purple-400">await</span>{" "}
                        <span className="text-blue-400">response</span>
                        <span className="text-white">.</span>
                        <span className="text-yellow-400">json</span>
                        <span className="text-white">()</span>
                        <span className="text-white">;</span>
                        <br />
                        &nbsp;&nbsp;<span className="text-white">
                          {"}"}
                        </span>{" "}
                        <span className="text-purple-400">catch</span>{" "}
                        <span className="text-white">(</span>
                        <span className="text-blue-400">error</span>
                        <span className="text-white">) {"{"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-gray-400">
                          // Handle connection needed case
                        </span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-purple-400">if</span>{" "}
                        <span className="text-white">(</span>
                        <span className="text-blue-400">error</span>
                        <span className="text-white">.</span>
                        <span className="text-green-400">code</span>{" "}
                        <span className="text-white">===</span>{" "}
                        <span className="text-orange-400">
                          "token_not_found"
                        </span>
                        <span className="text-white">) {"{"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-purple-400">return</span>{" "}
                        <span className="text-white">{"{"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">needsConnection</span>
                        <span className="text-white">:</span>{" "}
                        <span className="text-purple-400">true</span>
                        <span className="text-white">,</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-green-400">provider</span>
                        <span className="text-white">:</span>{" "}
                        <span className="text-blue-400">params</span>
                        <span className="text-white">.</span>
                        <span className="text-green-400">provider</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-white">{"}"}</span>
                        <span className="text-white">;</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-white">{"}"}</span>
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span className="text-purple-400">throw</span>{" "}
                        <span className="text-blue-400">error</span>
                        <span className="text-white">;</span>
                        <br />
                        &nbsp;&nbsp;<span className="text-white">{"}"}</span>
                        <br />
                        <span className="text-white">{"}"}</span>
                      </code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-16 md:py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent inline-block">
              What if I want these tools to connect to my APIs?
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full mt-2 mb-4"></div>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Transform your application into a OAuth provider that other
              platforms can seamlessly integrate with, with Descope Inbound
              Apps.
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl overflow-hidden shadow-md">
            <div className="grid md:grid-cols-2 gap-0">
              <div className="p-8 md:p-10 flex flex-col justify-center">
                <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Descope Inbound Apps
                </h3>
                <p className="text-muted-foreground mb-6">
                  Inbound Apps help your apps become a service provider that
                  others can connect to. Create secure integration points that
                  allow third-party applications to leverage your platform's
                  functionality through standardized OAuth protocols.
                </p>
                <a
                  href="https://10x-crm.app"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                >
                  Explore 10x CRM for more details
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </div>
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-8 md:p-10 text-white">
                <h3 className="text-xl font-semibold mb-4">
                  Provider Benefits
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="bg-white/20 p-1 rounded-full mr-3 mt-1">
                      <svg
                        className="h-3 w-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    <span>Control access to your platform's resources</span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-white/20 p-1 rounded-full mr-3 mt-1">
                      <svg
                        className="h-3 w-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    <span>
                      Implement time-based scopes for precise scoped access
                      control
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-white/20 p-1 rounded-full mr-3 mt-1">
                      <svg
                        className="h-3 w-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    <span>
                      Allow outbound apps to easily manage scoped tokens for
                      your application and APIs
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-white/20 p-1 rounded-full mr-3 mt-1">
                      <svg
                        className="h-3 w-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    <span>
                      Make it easy for end users to grant consent to your app's
                      resources
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-20 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-950/50 dark:to-purple-950/50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Ready to Build Powerful Connected Experiences?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Join all the developers who are creating AI agents with secure
            access to external tools and services with Descope.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="https://descope.com/sign-up">
              <Button
                size="lg"
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-6 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
              >
                Sign Up for Descope
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
              <span className="text-muted-foreground">Easy SDKs</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-muted-foreground">
                AuthTown and Support Community
              </span>
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

          <p className="text-xs text-muted-foreground mt-4 text-center w-full max-w-[500px] mx-auto px-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            In addition to our Privacy Policy, it's important to note that
            Google Workspace APIs are not used to develop, improve, or train
            generalized AI and/or ML models.
          </p>
        </div>
      </footer>
    </div>
  );
}
