"use client";

import { useState, useEffect } from "react";

export const TypingDots = () => {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev % 3) + 1);
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-flex items-center h-6 align-middle">
      <span
        className={`inline-block w-2 h-2 bg-current rounded-full mx-0.5 transition-transform duration-300 ease-in-out ${
          dots >= 1 ? "transform translate-y-[-3px]" : ""
        }`}
        style={{ transitionDelay: "0ms" }}
      ></span>
      <span
        className={`inline-block w-2 h-2 bg-current rounded-full mx-0.5 transition-transform duration-300 ease-in-out ${
          dots >= 2 ? "transform translate-y-[-3px]" : ""
        }`}
        style={{ transitionDelay: "150ms" }}
      ></span>
      <span
        className={`inline-block w-2 h-2 bg-current rounded-full mx-0.5 transition-transform duration-300 ease-in-out ${
          dots >= 3 ? "transform translate-y-[-3px]" : ""
        }`}
        style={{ transitionDelay: "300ms" }}
      ></span>
    </span>
  );
};

export default TypingDots;
