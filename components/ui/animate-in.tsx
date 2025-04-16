import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type AnimationVariant = "fadeIn" | "scaleIn" | "slideIn";
type AnimationDirection = "up" | "down" | "left" | "right";
type AnimationDelay = "none" | "sm" | "md" | "lg";

interface AnimateInProps {
  children: ReactNode;
  className?: string;
  variant?: AnimationVariant;
  direction?: AnimationDirection;
  delay?: AnimationDelay;
  duration?: number;
  once?: boolean;
}

export function AnimateIn({
  children,
  className,
  variant = "fadeIn",
  direction = "up",
  delay = "none",
  duration = 300,
  once = true,
}: AnimateInProps) {
  const getDirectionClass = () => {
    if (variant !== "fadeIn" && variant !== "slideIn") return "";

    switch (direction) {
      case "up":
        return "from-translate-y-4";
      case "down":
        return "from-translate-y-[-1rem]";
      case "left":
        return "from-translate-x-4";
      case "right":
        return "from-translate-x-[-1rem]";
      default:
        return "";
    }
  };

  const getDelayClass = () => {
    switch (delay) {
      case "sm":
        return "animation-delay-100";
      case "md":
        return "animation-delay-200";
      case "lg":
        return "animation-delay-300";
      default:
        return "";
    }
  };

  const getAnimationClass = () => {
    return `animate-${variant} ${getDirectionClass()} ${getDelayClass()}`;
  };

  const animationStyle = {
    animationDuration: `${duration}ms`,
  };

  return (
    <div
      className={cn(getAnimationClass(), className)}
      style={animationStyle}
      data-animate-once={once}
    >
      {children}
    </div>
  );
}

// Add these classes to your tailwind config if not already present
// animation-delay-100, animation-delay-200, animation-delay-300
// or add it inline in globals.css
