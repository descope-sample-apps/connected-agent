"use client";

import type { ReactNode } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import Image from "next/image";

interface ActionCardProps {
  title: string;
  description: string;
  logo: string;
  onClick: () => void;
}

export default function ActionCard({
  title,
  description,
  logo,
  onClick,
}: ActionCardProps) {
  return (
    <Card
      className="overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer border-gray-200 dark:border-gray-700 hover:border-primary/50 dark:hover:border-primary/50"
      onClick={onClick}
    >
      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 p-1.5">
            <Image src={logo} alt={title} fill className="object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium truncate">
              {title}
            </CardTitle>
            <CardDescription className="text-xs line-clamp-1">
              {description}
            </CardDescription>
          </div>
        </div>
      </div>
    </Card>
  );
}
