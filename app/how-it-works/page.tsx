"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Check, Database, Key, Lock, Shield } from "lucide-react";

export default function HowItWorksPage() {
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
          How It Works
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Learn how the CRM Assistant connects securely to your services and
          helps you manage your business data.
        </p>
      </div>

      {/* Overview Section */}
      <section className="mb-16">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-4">
            Understanding Inbound Apps
          </h2>
          <p className="mb-4">
            The CRM Assistant uses Inbound Apps to securely connect to your
            services like CRM tools, Google Calendar, and Google Meet. This
            technology allows the assistant to access your data without storing
            your credentials or requiring full access to your accounts.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            <div className="flex flex-col">
              <h3 className="text-xl font-semibold mb-3">
                How Inbound Apps Work
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="mr-2 mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </span>
                  <span>Secure OAuth authentication with your services</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </span>
                  <span>Permission-based access with limited scopes</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </span>
                  <span>Temporary tokens that you can revoke anytime</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </span>
                  <span>No credentials stored on our servers</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col">
              <h3 className="text-xl font-semibold mb-3">Benefits for You</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="mr-2 mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </span>
                  <span>
                    Access your data across multiple services in one place
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </span>
                  <span>AI-powered assistance with your business tasks</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </span>
                  <span>Complete control over what data is accessed</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </span>
                  <span>Revoke access at any time from your profile</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">Security and Privacy</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
            <div className="rounded-full w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
              <Lock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">OAuth Protection</h3>
            <p className="text-muted-foreground text-sm">
              Industry-standard OAuth 2.0 ensures secure authentication without
              ever handling your passwords.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
            <div className="rounded-full w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
              <Key className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Limited Permissions</h3>
            <p className="text-muted-foreground text-sm">
              We only request the minimum permissions needed for each service to
              function properly.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
            <div className="rounded-full w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
              <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Token Management</h3>
            <p className="text-muted-foreground text-sm">
              Access tokens are encrypted, temporary, and can be revoked by you
              at any time.
            </p>
          </div>
        </div>
      </section>

      {/* Connection Process */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">Connection Process</h2>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="flex flex-col">
              <div className="rounded-full w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-indigo-600">1</span>
              </div>
              <h3 className="font-medium mb-2">Request Connection</h3>
              <p className="text-sm text-muted-foreground">
                When you ask about your CRM data or calendar, the assistant will
                prompt you to connect.
              </p>
            </div>

            <div className="flex flex-col">
              <div className="rounded-full w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-indigo-600">2</span>
              </div>
              <h3 className="font-medium mb-2">OAuth Flow</h3>
              <p className="text-sm text-muted-foreground">
                You'll be directed to the service provider's login page where
                you grant limited permissions.
              </p>
            </div>

            <div className="flex flex-col">
              <div className="rounded-full w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-indigo-600">3</span>
              </div>
              <h3 className="font-medium mb-2">Secure Token Exchange</h3>
              <p className="text-sm text-muted-foreground">
                A secure token is generated that allows limited access without
                storing your credentials.
              </p>
            </div>

            <div className="flex flex-col">
              <div className="rounded-full w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-indigo-600">4</span>
              </div>
              <h3 className="font-medium mb-2">Ready to Use</h3>
              <p className="text-sm text-muted-foreground">
                The assistant can now access your data securely to answer
                questions and perform tasks.
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold mb-3">Manage Your Connections</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You can view and manage all your connected services from your
              profile at any time. This includes:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <li className="flex items-center">
                <span className="mr-2 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                  <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                </span>
                <span>Viewing what permissions are granted</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                  <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                </span>
                <span>Disconnecting services you no longer need</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                  <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                </span>
                <span>Reconnecting with different permissions</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2 bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                  <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                </span>
                <span>Managing token expiration and renewal</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Supported Services */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">Supported Services</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <img
              src="/logos/crm-logo.png"
              alt="CRM"
              className="h-12 w-12 mb-4"
            />
            <h3 className="font-semibold text-lg mb-2">CRM Systems</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Access customer data, deals, contacts, and sales information from
              your CRM.
            </p>
            <div className="flex items-center text-xs text-muted-foreground">
              <Database className="h-3 w-3 mr-1" />
              <span>Contacts, Deals, Accounts, Reports</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <img
              src="/logos/google-calendar.png"
              alt="Google Calendar"
              className="h-12 w-12 mb-4"
            />
            <h3 className="font-semibold text-lg mb-2">Google Calendar</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Manage your schedule, create events, and get reminders for
              upcoming meetings.
            </p>
            <div className="flex items-center text-xs text-muted-foreground">
              <Database className="h-3 w-3 mr-1" />
              <span>Events, Schedules, Availability</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <img
              src="/logos/google-meet-logo.png"
              alt="Google Meet"
              className="h-12 w-12 mb-4"
            />
            <h3 className="font-semibold text-lg mb-2">Google Meet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Schedule and join video conferences directly through the
              assistant.
            </p>
            <div className="flex items-center text-xs text-muted-foreground">
              <Database className="h-3 w-3 mr-1" />
              <span>Meetings, Video Calls, Participants</span>
            </div>
          </div>
        </div>
      </section>

      {/* Get Started CTA */}
      <section className="text-center mb-16 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-12 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Return to chat and start asking questions about your business data.
          Connect your services when prompted and experience the power of
          AI-assisted management.
        </p>
        <Link href="/" passHref>
          <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-8 py-6 h-auto text-lg">
            Back to Chat
          </Button>
        </Link>
      </section>

      {/* FAQ Section */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
          <div>
            <h3 className="font-semibold text-lg mb-2">Is my data secure?</h3>
            <p className="text-muted-foreground">
              Yes, we use industry-standard OAuth 2.0 for authentication. We
              never store your passwords, and access tokens are encrypted and
              temporary.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2">Can I revoke access?</h3>
            <p className="text-muted-foreground">
              Absolutely. You can disconnect any service at any time from your
              profile settings.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2">
              What permissions are requested?
            </h3>
            <p className="text-muted-foreground">
              We only request the minimum permissions needed for each service.
              For example, calendar read/write access for Google Calendar, but
              not access to your emails.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2">
              How often do I need to reconnect?
            </h3>
            <p className="text-muted-foreground">
              OAuth tokens typically expire after a certain period (usually 7
              days to several months). The assistant will prompt you to
              reconnect when needed.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
