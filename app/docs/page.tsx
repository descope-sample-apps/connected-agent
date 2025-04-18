"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Book,
  Code,
  FileText,
  Github,
  HelpCircle,
  MessageSquare,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DocumentationPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="mb-8">
        <Link
          href="/"
          className="flex items-center text-indigo-600 hover:text-indigo-800 mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Chat
        </Link>
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          Documentation
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Comprehensive resources to help you get the most out of your CRM
          Assistant.
        </p>
      </div>

      {/* Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="md:col-span-1 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
          <nav className="sticky top-20">
            <ul className="space-y-2">
              <li>
                <a
                  href="#getting-started"
                  className="flex items-center py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md text-indigo-600 dark:text-indigo-400"
                >
                  <Book className="h-4 w-4 mr-2" />
                  <span>Getting Started</span>
                </a>
              </li>
              <li>
                <a
                  href="#commands"
                  className="flex items-center py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <Terminal className="h-4 w-4 mr-2" />
                  <span>Commands & Queries</span>
                </a>
              </li>
              <li>
                <a
                  href="#connections"
                  className="flex items-center py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <Code className="h-4 w-4 mr-2" />
                  <span>Connection Management</span>
                </a>
              </li>
              <li>
                <a
                  href="#api"
                  className="flex items-center py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  <span>API Reference</span>
                </a>
              </li>
              <li>
                <a
                  href="#faqs"
                  className="flex items-center py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  <span>FAQs</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="md:col-span-3 space-y-12">
          {/* Getting Started */}
          <section id="getting-started">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-2xl font-bold mb-4">Getting Started</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    1. Create an Account
                  </h3>
                  <p className="text-muted-foreground mb-3">
                    Sign up with your email or use single sign-on with Google.
                  </p>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                    <p className="text-sm">
                      New users receive{" "}
                      <span className="font-medium">50 free messages</span> per
                      month to try the service.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    2. Connect Your Services
                  </h3>
                  <p className="text-muted-foreground mb-3">
                    Connect your CRM, calendar, and other tools to unlock the
                    full power of the assistant.
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                    <li>Go to Profile {">"} Connections</li>
                    <li>
                      Click "Connect" next to each service you want to use
                    </li>
                    <li>Grant the necessary permissions when prompted</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    3. Start Asking Questions
                  </h3>
                  <p className="text-muted-foreground mb-3">
                    Use natural language to ask about your data or request
                    actions.
                  </p>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-md text-indigo-800 dark:text-indigo-300 text-sm">
                    <p className="font-medium mb-2">Example queries:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>"Show me deals closing this month"</li>
                      <li>"Schedule a meeting with John tomorrow at 2pm"</li>
                      <li>"Create a summary of last quarter's sales"</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Commands & Queries */}
          <section id="commands">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-2xl font-bold mb-4">Commands & Queries</h2>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-medium">
                        Command Type
                      </th>
                      <th className="text-left py-3 px-4 font-medium">
                        Examples
                      </th>
                      <th className="text-left py-3 px-4 font-medium">
                        Required Connection
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-3 px-4">CRM Queries</td>
                      <td className="py-3 px-4">
                        "Show deals with Company X"
                        <br />
                        "List my contacts in New York"
                      </td>
                      <td className="py-3 px-4">CRM</td>
                    </tr>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-3 px-4">Calendar Management</td>
                      <td className="py-3 px-4">
                        "Schedule a meeting tomorrow at 3pm"
                        <br />
                        "What's on my calendar this week?"
                      </td>
                      <td className="py-3 px-4">Google Calendar</td>
                    </tr>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-3 px-4">Meeting Setup</td>
                      <td className="py-3 px-4">
                        "Create a video call with the marketing team"
                        <br />
                        "Set up a 30-minute interview call"
                      </td>
                      <td className="py-3 px-4">Google Meet</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Data Analysis</td>
                      <td className="py-3 px-4">
                        "Show me this month's sales pipeline"
                        <br />
                        "Compare Q1 vs Q2 performance"
                      </td>
                      <td className="py-3 px-4">CRM</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Connection Management */}
          <section id="connections">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-2xl font-bold mb-4">Connection Management</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Viewing Connections
                  </h3>
                  <p className="text-muted-foreground mb-3">
                    Go to your Profile {">"} Connections tab to view all your
                    connected services.
                  </p>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm">
                    <p>
                      You'll see the connection status, permissions granted, and
                      when the connection will expire.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Managing Permissions
                  </h3>
                  <p className="text-muted-foreground mb-3">
                    You can disconnect services or reconnect with different
                    permissions at any time.
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                    <li>Click "Disconnect" to revoke access</li>
                    <li>Click "Connect" to set up a connection again</li>
                    <li>
                      Click "Update Permissions" if available to modify scopes
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Troubleshooting
                  </h3>
                  <p className="text-muted-foreground mb-3">
                    If you encounter connection issues, try these steps:
                  </p>
                  <ol className="list-decimal pl-6 space-y-1 text-sm text-muted-foreground">
                    <li>Disconnect and reconnect the service</li>
                    <li>Check that all necessary permissions are granted</li>
                    <li>
                      Ensure your service account is active and not locked
                    </li>
                    <li>Clear browser cookies and try again</li>
                  </ol>
                </div>
              </div>
            </div>
          </section>

          {/* API Reference */}
          <section id="api">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-2xl font-bold mb-4">API Reference</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">REST API</h3>
                  <p className="text-muted-foreground mb-3">
                    Our REST API allows you to integrate the CRM Assistant with
                    your own applications.
                  </p>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm font-mono overflow-x-auto">
                    <p>
                      Base URL: <code>https://api.crm-assistant.com/v1</code>
                    </p>
                    <p className="mt-2">Authentication: Bearer Token</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Endpoints</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm">
                      <p className="font-medium text-indigo-600 dark:text-indigo-400">
                        GET /connections
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        List all connected services for the authenticated user
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm">
                      <p className="font-medium text-indigo-600 dark:text-indigo-400">
                        POST /chat/messages
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Send a message to the assistant
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm">
                      <p className="font-medium text-indigo-600 dark:text-indigo-400">
                        GET /chat/history
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Retrieve chat history for the authenticated user
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center mt-6">
                  <a
                    href="https://api.crm-assistant.com/docs"
                    className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/30 rounded-lg text-sm text-indigo-600 dark:text-indigo-400 font-medium border border-indigo-100 dark:border-indigo-800 flex items-center transition-colors"
                  >
                    <Book className="h-4 w-4 mr-2" />
                    View Full API Documentation
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* FAQs */}
          <section id="faqs">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-2xl font-bold mb-4">
                Frequently Asked Questions
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    How does the assistant access my data?
                  </h3>
                  <p className="text-muted-foreground">
                    The assistant uses OAuth 2.0 to request limited access to
                    your services. You authorize which services to connect and
                    what permissions to grant. No passwords are stored, and you
                    can revoke access at any time.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Is my data private and secure?
                  </h3>
                  <p className="text-muted-foreground">
                    Yes. All data is encrypted in transit and at rest. We use
                    industry-standard security practices to protect your
                    information. Your data is only accessed when needed to
                    fulfill your requests and is not shared with third parties.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    What CRM systems are supported?
                  </h3>
                  <p className="text-muted-foreground">
                    Currently, we support major CRMs including Salesforce,
                    HubSpot, and Pipedrive. We're constantly adding support for
                    additional systems. If your CRM isn't supported, please
                    contact us.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    How many messages can I send?
                  </h3>
                  <p className="text-muted-foreground">
                    Free accounts include 50 messages per month. Premium
                    accounts start at 500 messages per month with additional
                    tiers available for high-volume users. Visit our pricing
                    page for more details.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    How do I get help?
                  </h3>
                  <p className="text-muted-foreground mb-3">
                    If you need assistance, there are several ways to get help:
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <li>
                      <a
                        href="/support"
                        className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      >
                        <MessageSquare className="h-4 w-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-sm">Contact Support</span>
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://github.com/crm-assistant/issues"
                        className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      >
                        <Github className="h-4 w-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-sm">GitHub Issues</span>
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Help CTA */}
      <div className="text-center mt-12 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-8 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
        <h2 className="text-2xl font-bold mb-3">Still have questions?</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
          We're here to help! Our support team is available to answer any
          questions you might have about using the CRM Assistant.
        </p>
        <div className="flex justify-center space-x-4">
          <Link href="/support" passHref>
            <Button
              variant="outline"
              className="border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
            >
              Contact Support
            </Button>
          </Link>
          <Link href="/" passHref>
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
              Back to Chat
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
