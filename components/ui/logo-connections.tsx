"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { AnimatedBeam } from "./animated-beam";

// Service logos to connect with beams
const services = [
  { name: "Google Drive", icon: "/logos/google-drive.svg" },
  { name: "Notion", icon: "/logos/notion.svg" },
  { name: "WhatsApp", icon: "/logos/whatsapp.svg" },
  { name: "Slack", icon: "/logos/slack.svg" },
  { name: "Gmail", icon: "/logos/gmail.svg" },
  { name: "Salesforce", icon: "/logos/salesforce.svg" },
  { name: "HubSpot", icon: "/logos/hubspot.svg" },
  { name: "Zapier", icon: "/logos/zapier.svg" },
];

export function LogoConnections() {
  const containerRef = useRef<HTMLDivElement>(null);
  const centralRef = useRef<HTMLDivElement>(null);
  const logoRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [points, setPoints] = useState<{
    central: { x: number; y: number };
    logos: { x: number; y: number }[];
  }>({
    central: { x: 0, y: 0 },
    logos: [],
  });
  const [showBeams, setShowBeams] = useState(false);

  // Calculate positions on mount and window resize
  useEffect(() => {
    const updatePositions = () => {
      if (!containerRef.current || !centralRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const centralRect = centralRef.current.getBoundingClientRect();

      // Calculate center point of central logo relative to container
      const centralPoint = {
        x: centralRect.left - containerRect.left + centralRect.width / 2,
        y: centralRect.top - containerRect.top + centralRect.height / 2,
      };

      // Calculate points for service logos
      const logoPoints = logoRefs.current.map((ref) => {
        if (!ref) return { x: 0, y: 0 };
        const rect = ref.getBoundingClientRect();
        return {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2,
        };
      });

      setPoints({
        central: centralPoint,
        logos: logoPoints,
      });

      // Show beams after positions are calculated
      setShowBeams(true);
    };

    // Update positions after a short delay to ensure refs are available
    const timer = setTimeout(() => {
      updatePositions();
    }, 100);

    window.addEventListener("resize", updatePositions);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePositions);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-3xl h-[400px] mx-auto"
    >
      {/* SVG for gradient definition */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="beamGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.3" />
          </linearGradient>
        </defs>
      </svg>

      {/* Container for beams */}
      <div className="absolute inset-0 overflow-visible">
        {showBeams && (
          <svg className="absolute inset-0 w-full h-full overflow-visible">
            {points.logos.map((logoPoint, i) => (
              <AnimatedBeam
                key={i}
                startPoint={points.central}
                endPoint={logoPoint}
                initialDelay={i * 200}
              />
            ))}
          </svg>
        )}
      </div>

      {/* Central Descope logo */}
      <div
        ref={centralRef}
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10"
      >
        <div className="bg-white rounded-full p-4 shadow-lg">
          <Image
            src="/logos/descope.svg"
            alt="Descope"
            width={60}
            height={60}
          />
        </div>
      </div>

      {/* Service logos in a circular arrangement */}
      {services.map((service, i) => {
        // Calculate position in a circle around the center
        const angle = i * (360 / services.length) * (Math.PI / 180);
        const radius = 150; // Distance from center
        const style = {
          left: `calc(50% + ${Math.cos(angle) * radius}px)`,
          top: `calc(50% + ${Math.sin(angle) * radius}px)`,
        };

        return (
          <div
            key={i}
            ref={(el) => {
              logoRefs.current[i] = el;
            }}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-md z-20"
            style={style}
          >
            <Image
              src={service.icon}
              alt={service.name}
              width={36}
              height={36}
            />
          </div>
        );
      })}
    </div>
  );
}
