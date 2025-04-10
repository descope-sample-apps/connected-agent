"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { AnimatedBeam } from "./animated-beam";

type ServiceIcon = {
  name: string;
  icon: string;
  position: { x: number; y: number };
  delay: number;
};

export function ConnectionAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [centerPosition, setCenterPosition] = useState({ x: 0, y: 0 });
  const [showBeams, setShowBeams] = useState(false);

  // Define service icons with their positions (will be calculated relative to container)
  const services: ServiceIcon[] = [
    {
      name: "Google Drive",
      icon: "/icons/gdrive.svg",
      position: { x: 0.15, y: 0.2 },
      delay: 0,
    },
    {
      name: "Notion",
      icon: "/icons/notion.svg",
      position: { x: 0.15, y: 0.8 },
      delay: 0.5,
    },
    {
      name: "WhatsApp",
      icon: "/icons/whatsapp.svg",
      position: { x: 0.85, y: 0.2 },
      delay: 1.0,
    },
    {
      name: "Slack",
      icon: "/icons/slack.svg",
      position: { x: 0.85, y: 0.8 },
      delay: 1.5,
    },
    {
      name: "Gmail",
      icon: "/icons/gmail.svg",
      position: { x: 0.3, y: 0.5 },
      delay: 2.0,
    },
    {
      name: "Teams",
      icon: "/icons/teams.svg",
      position: { x: 0.7, y: 0.5 },
      delay: 2.5,
    },
  ];

  // Calculate absolute positions based on container size
  useEffect(() => {
    if (!containerRef.current) return;

    const updateContainerSize = () => {
      if (!containerRef.current) return;

      const { width, height } = containerRef.current.getBoundingClientRect();
      setContainerSize({ width, height });
      setCenterPosition({ x: width / 2, y: height / 2 });

      // Show beams after positions are calculated
      setTimeout(() => setShowBeams(true), 500);
    };

    updateContainerSize();
    window.addEventListener("resize", updateContainerSize);

    return () => window.removeEventListener("resize", updateContainerSize);
  }, []);

  const getAbsolutePosition = (relativePosition: { x: number; y: number }) => {
    return {
      x: relativePosition.x * containerSize.width,
      y: relativePosition.y * containerSize.height,
    };
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-[450px] relative flex items-center justify-center"
    >
      {/* Central Descope logo */}
      <div
        className="absolute z-10 transform -translate-x-1/2 -translate-y-1/2"
        style={{
          left: centerPosition.x,
          top: centerPosition.y,
        }}
      >
        <div className="bg-white rounded-full p-3 shadow-lg">
          <Image
            src="/icons/descope.svg"
            alt="Descope Logo"
            width={60}
            height={60}
            className="h-[60px] w-[60px]"
          />
        </div>
      </div>

      {/* Service icons */}
      {services.map((service, index) => {
        const { x, y } = getAbsolutePosition(service.position);

        return (
          <div
            key={service.name}
            className="absolute z-10 transform -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500"
            style={{
              left: x,
              top: y,
              opacity: containerSize.width > 0 ? 1 : 0,
            }}
          >
            <div className="bg-white rounded-full p-2 shadow-md">
              <Image
                src={service.icon}
                alt={service.name}
                width={40}
                height={40}
                className="h-[40px] w-[40px]"
              />
            </div>
            <div className="text-xs text-center mt-1 font-medium text-gray-600">
              {service.name}
            </div>
          </div>
        );
      })}

      {/* Connection beams */}
      {showBeams &&
        containerSize.width > 0 &&
        services.map((service) => (
          <AnimatedBeam
            key={service.name}
            start={getAbsolutePosition(service.position)}
            end={centerPosition}
            delay={service.delay}
            color="#6366F1"
          />
        ))}
    </div>
  );
}
