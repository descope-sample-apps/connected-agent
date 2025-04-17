"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            Connected Agent Platform
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            A powerful platform that connects your applications with Descope SDK for seamless authentication and user management.
          </p>
          <Link href="/login">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6">
              Get Started
            </Button>
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16">How It Works</h2>
          <div className="space-y-24">
            {/* Feature 1 */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="p-8 border rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                  <span className="text-3xl">1</span>
                </div>
                <h3 className="text-2xl font-semibold mb-4">Setup outbound applications in Descope</h3>
                <p className="text-gray-600 text-lg">
                  Setup outbound applications in Descope to connect your agent to any of the dozens of pre-defined applications.
                </p>
              </div>
              <div className="relative h-[500px] bg-gray-100 rounded-xl overflow-hidden">
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
              <div className="relative h-[500px] bg-gray-100 rounded-xl overflow-hidden order-2 md:order-1">
                <Image
                  src="/images/dashboard-config.png"
                  alt="Dashboard Configuration"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-8 border rounded-xl shadow-sm hover:shadow-md transition-shadow order-1 md:order-2">
                <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                  <span className="text-3xl">2</span>
                </div>
                <h3 className="text-2xl font-semibold mb-4">Design and build your tools</h3>
                <p className="text-gray-600 text-lg">
                  Design your tools using the sample code in this application.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="p-8 border rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                  <span className="text-3xl">3</span>
                </div>
                <h3 className="text-2xl font-semibold mb-4">Fetch and use the token using Descope SDK</h3>
                <p className="text-gray-600 text-lg">
                  Use Descope SDK to fetch the token and connect to applications.
                </p>
              </div>
              <div className="relative h-[500px] bg-gray-100 rounded-xl overflow-hidden">
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
      <div className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16">Descope SDK Integration</h2>
          <div className="max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-sm mb-12">
              <h3 className="text-2xl font-semibold mb-6">Key Features</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">✓</span>
                  <span className="text-lg">Secure authentication flows with multiple methods</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">✓</span>
                  <span className="text-lg">User management and profile handling</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">✓</span>
                  <span className="text-lg">Role-based access control</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">✓</span>
                  <span className="text-lg">Seamless integration with existing applications</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm">
              <h3 className="text-2xl font-semibold mb-6">Sample Integration Code</h3>
              <div className="relative h-[600px] bg-gray-100 rounded-xl overflow-hidden">
                <Image
                  src="/images/code-example.png"
                  alt="Code Example"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Join us and transform your application's authentication experience with Descope SDK.
          </p>
          <Link href="/login">
            <Button size="lg" variant="secondary" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6">
              Start Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
} 