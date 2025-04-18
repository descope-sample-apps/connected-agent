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
      className="overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer border-gray-100 dark:border-gray-800 hover:border-indigo-100 dark:hover:border-indigo-900/50"
      onClick={onClick}
    >
      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/40 p-1.5">
            <Image src={logo} alt={title} fill className="object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium truncate bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
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
