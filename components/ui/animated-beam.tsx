"use client";

import React, { useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";

type Point = {
  x: number;
  y: number;
};

interface AnimatedBeamProps {
  start: Point;
  end: Point;
  color?: string;
  width?: number;
  duration?: number;
  delay?: number;
}

export function AnimatedBeam({
  start,
  end,
  color = "#6366F1",
  width = 2,
  duration = 0.8,
  delay = 0,
}: AnimatedBeamProps) {
  const controls = useAnimation();
  const pathLength = useRef(0);

  // Calculate the path and its length
  const path = `M${start.x},${start.y} C${(start.x + end.x) / 2},${start.y} ${
    (start.x + end.x) / 2
  },${end.y} ${end.x},${end.y}`;

  useEffect(() => {
    // Start the animation
    controls.start({
      pathLength: 1,
      opacity: [0, 0.8, 0.8, 0],
      transition: {
        pathLength: {
          type: "spring",
          duration: duration,
          delay: delay,
          repeat: Infinity,
          repeatDelay: 3,
        },
        opacity: {
          duration: duration * 1.5,
          delay: delay,
          times: [0, 0.2, 0.8, 1],
          repeat: Infinity,
          repeatDelay: 3,
        },
      },
    });
  }, [controls, duration, delay]);

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={width}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={controls}
      />
    </svg>
  );
}
