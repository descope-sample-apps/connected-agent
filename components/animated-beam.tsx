"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useMobile } from "@/hooks/use-mobile";

const AnimatedBeamComponent = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useMobile();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if component is visible in viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          } else {
            setIsVisible(false);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size with higher resolution for retina displays
    const scale = window.devicePixelRatio || 1;

    // Get actual DOM elements for more accurate positioning
    const agentElement = container.querySelector(
      '[data-element="agent"]'
    ) as HTMLElement;
    const descopeElement = container.querySelector(
      '[data-element="descope"]'
    ) as HTMLElement;
    const appElements = Array.from(
      container.querySelectorAll('[data-element="app"]')
    ) as HTMLElement[];

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;
      ctx.scale(scale, scale);
    };

    resizeCanvas();

    // Animation function
    const animate = () => {
      if (
        !canvas ||
        !container ||
        !agentElement ||
        !descopeElement ||
        appElements.length === 0
      )
        return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Get the actual positions from the DOM for more accurate connections
      const containerRect = container.getBoundingClientRect();

      // Agent position
      const agentRect = agentElement.getBoundingClientRect();
      const agentX = agentRect.left + agentRect.width / 2 - containerRect.left;
      const agentBottom = agentRect.bottom - containerRect.top;

      // Descope position
      const descopeRect = descopeElement.getBoundingClientRect();
      const descopeX =
        descopeRect.left + descopeRect.width / 2 - containerRect.left;
      const descopeTop = descopeRect.top - containerRect.top;
      const descopeBottom = descopeRect.bottom - containerRect.top;

      // App positions
      const appPositions = appElements.map((app) => {
        const appRect = app.getBoundingClientRect();
        return {
          x: appRect.left + appRect.width / 2 - containerRect.left,
          top: appRect.top - containerRect.top,
          bottom: appRect.bottom - containerRect.top,
          width: appRect.width,
          height: appRect.height,
        };
      });

      // Draw connecting lines with indigo-to-purple gradient (matching landing page)
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "rgba(99, 102, 241, 0.4)"); // indigo-500
      gradient.addColorStop(0.5, "rgba(129, 140, 248, 0.3)"); // indigo-400
      gradient.addColorStop(1, "rgba(168, 85, 247, 0.2)"); // purple-500
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;

      // Draw line from agent to Descope with proper connection points
      ctx.beginPath();
      ctx.moveTo(agentX, agentBottom); // Start from bottom of agent icon
      ctx.lineTo(descopeX, descopeTop); // End at top of Descope icon
      ctx.stroke();

      // Draw lines from Descope to apps with enhanced curves and proper connection points
      appPositions.forEach((app, i) => {
        ctx.beginPath();
        ctx.moveTo(descopeX, descopeBottom); // Start from bottom of Descope icon

        // Calculate control points for smoother curves
        const startX = descopeX;
        const startY = descopeBottom;
        const endX = app.x;
        const endY = app.top;

        // Calculate distance for proportional control points
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Adjust control points based on position relative to center and distance
        const isLeft = endX < startX;
        const controlY1 = startY + dy * 0.25;
        const controlY2 = endY - dy * 0.25;
        const controlX1 = startX + (isLeft ? -distance * 0.2 : distance * 0.2);
        const controlX2 = endX + (isLeft ? distance * 0.2 : -distance * 0.2);

        // Draw curved line with better control points
        ctx.bezierCurveTo(
          controlX1,
          controlY1,
          controlX2,
          controlY2,
          endX,
          endY
        );
        ctx.stroke();
      });

      // Animate particles with enhanced effects
      const time = Date.now() * 0.001;
      const particlePositions = [];

      // Particle from agent to Descope
      const agentToDescopeProgress = (Math.sin(time * 0.7) + 1) / 2;
      const agentToDescopeDistance = descopeTop - agentBottom;

      particlePositions.push({
        x: agentX,
        y: agentBottom + agentToDescopeDistance * agentToDescopeProgress,
      });

      // Particles from Descope to apps
      appPositions.forEach((app, i) => {
        const progress = (Math.sin(time * 0.7 + i * 0.5) + 1) / 2;
        const startX = descopeX;
        const startY = descopeBottom;
        const endX = app.x;
        const endY = app.top;

        // Calculate distance for proportional control points
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Adjust control points based on position relative to center and distance
        const isLeft = endX < startX;
        const controlY1 = startY + dy * 0.25;
        const controlY2 = endY - dy * 0.25;
        const controlX1 = startX + (isLeft ? -distance * 0.2 : distance * 0.2);
        const controlX2 = endX + (isLeft ? distance * 0.2 : -distance * 0.2);

        // Calculate position along the curve using cubic Bezier formula
        const t = progress;
        const mt = 1 - t;
        const curveX =
          mt * mt * mt * startX +
          3 * mt * mt * t * controlX1 +
          3 * mt * t * t * controlX2 +
          t * t * t * endX;
        const curveY =
          mt * mt * mt * startY +
          3 * mt * mt * t * controlY1 +
          3 * mt * t * t * controlY2 +
          t * t * t * endY;

        particlePositions.push({ x: curveX, y: curveY });
      });

      // Draw enhanced particles with indigo-to-purple gradient
      particlePositions.forEach(({ x, y }) => {
        const particleGradient = ctx.createRadialGradient(x, y, 0, x, y, 5);
        particleGradient.addColorStop(0, "rgba(99, 102, 241, 0.9)"); // indigo-500
        particleGradient.addColorStop(0.5, "rgba(129, 140, 248, 0.5)"); // indigo-400
        particleGradient.addColorStop(1, "rgba(168, 85, 247, 0)"); // purple-500
        ctx.fillStyle = particleGradient;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      });

      if (isVisible) {
        requestAnimationFrame(animate);
      }
    };

    // Start animation after a short delay to ensure DOM elements are properly rendered
    const animationTimeout = setTimeout(() => {
      animate();
    }, 100);

    // Handle resize
    const handleResize = () => {
      resizeCanvas();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(animationTimeout);
      cancelAnimationFrame(animate as unknown as number);
      window.removeEventListener("resize", handleResize);
    };
  }, [isVisible]);

  // Simplified square robot design
  const SimpleRobotLogo = () => {
    return (
      <svg
        viewBox="0 0 24 24"
        className="w-full h-full text-indigo-500 dark:text-indigo-400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Simple square head */}
        <rect
          x="5"
          y="6"
          width="14"
          height="14"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.5"
        />

        {/* Simple square eyes */}
        <rect x="8" y="10" width="2" height="2" fill="currentColor" />
        <rect x="14" y="10" width="2" height="2" fill="currentColor" />

        {/* Simple antenna */}
        <path d="M12 6V3" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="2" width="2" height="1" fill="currentColor" />

        {/* Simple mouth */}
        <path d="M9 15H15" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  };

  // Adjust aspect ratio and layout for mobile
  const aspectRatio = isMobile ? "aspect-[4/5]" : "aspect-[16/9]";

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${aspectRatio} max-w-6xl mx-auto bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-0"
        style={{ width: "100%", height: "100%" }}
      />

      {/* AI Agent Logo - with data attribute for positioning */}
      <div
        data-element="agent"
        className="absolute z-10"
        style={{
          left: "50%",
          top: isMobile ? "30px" : "50px",
          transform: "translateX(-50%)",
        }}
      >
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur-lg opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative bg-gradient-to-r from-indigo-500 to-purple-600 p-[2px] rounded-full">
            <div className="bg-white dark:bg-gray-900 rounded-full p-3 sm:p-4">
              <div className="w-8 h-8 sm:w-12 sm:h-12 relative">
                <SimpleRobotLogo />
                <div className="absolute -right-1 -bottom-1 h-2 w-2 sm:h-3 sm:w-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 sm:-bottom-8 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium text-indigo-600 dark:text-indigo-400 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            AI Agent
          </div>
        </div>
      </div>

      {/* Descope Logo with data attribute for positioning */}
      <div
        data-element="descope"
        className="absolute z-10"
        style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
      >
        <div className="relative group">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-800 transition-all duration-300 group-hover:shadow-md">
            <Image
              src="/logos/descope-logo.png"
              alt="Descope"
              width={isMobile ? 36 : 48}
              height={isMobile ? 36 : 48}
              className="rounded"
            />
          </div>
          <div className="absolute -bottom-6 sm:-bottom-8 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium text-indigo-600 dark:text-indigo-400 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Descope
          </div>
        </div>
      </div>

      {/* Connected Apps with data attributes for positioning - mobile responsive */}
      <div
        className="absolute z-10"
        style={{
          left: "0",
          right: "0",
          bottom: isMobile ? "40px" : "100px",
        }}
      >
        <div
          className={`flex flex-wrap ${
            isMobile ? "justify-center gap-4" : "justify-between"
          } mx-auto`}
          style={{ width: isMobile ? "90%" : "70%" }}
        >
          {[
            { name: "Calendar", src: "/logos/google-calendar.png" },
            { name: "Slack", src: "/logos/slack-logo.svg" },
            { name: "Meet", src: "/logos/google-meet-logo.png" },
            { name: "10xCRM", src: "/logos/crm-logo.png" },
            { name: "Custom Tool", src: "/logos/custom-tool.svg" },
          ].map((app, index) => (
            <AppIcon
              key={index}
              name={app.name}
              src={app.src}
              isMobile={isMobile}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// App Icon Component with data attribute for positioning
const AppIcon = ({
  name,
  src,
  isMobile,
}: {
  name: string;
  src: string;
  isMobile: boolean;
}) => {
  return (
    <div data-element="app" className="relative group">
      <div
        className={`${
          isMobile ? "h-12 w-12" : "h-16 w-16"
        } bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center transition-all duration-300 group-hover:shadow-md`}
      >
        <Image
          src={src || "/placeholder.svg"}
          alt={name}
          width={isMobile ? 24 : 32}
          height={isMobile ? 24 : 32}
          className="rounded-full"
        />
      </div>
      <div className="absolute -bottom-6 sm:-bottom-8 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 px-2 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium text-indigo-600 dark:text-indigo-400 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {name}
      </div>
    </div>
  );
};

export default AnimatedBeamComponent;
