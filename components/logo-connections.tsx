"use client";

import Image from "next/image";

// Define the available services
const services = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    icon: "/logos/google-calendar.png",
  },
  {
    id: "google-docs",
    name: "Google Docs",
    icon: "/logos/google-docs.png",
  },
  {
    id: "zoom",
    name: "Zoom",
    icon: "/logos/zoom-logo.png",
  },
  {
    id: "custom-crm",
    name: "Outbound CRM",
    icon: "/logos/crm-logo.png",
  },
];

export default function LogoConnections() {
  return (
    <div className="mt-16 text-center">
      <p className="text-sm text-muted-foreground mb-5 opacity-70">
        Seamlessly integrates with your services
      </p>
      <div className="flex justify-center items-center gap-6">
        {services.map((service, index) => (
          <div
            key={service.id}
            className="relative w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-900 p-1.5 
              shadow-sm ring-1 ring-gray-200 dark:ring-gray-800 hover:scale-110 transition-transform duration-200"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <Image
              src={service.icon}
              alt={service.name}
              fill
              className="object-contain p-0.5"
              title={service.name}
              sizes="(max-width: 32px) 100vw, 32px"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
