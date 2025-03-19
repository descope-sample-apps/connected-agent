"use client"

import type { ReactNode } from "react"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"

interface ActionCardProps {
  title: string
  description: string
  icon: ReactNode
  onClick: () => void
}

export default function ActionCard({ title, description, icon, onClick }: ActionCardProps) {
  return (
    <Card
      className="overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer border-gray-200 dark:border-gray-700 hover:border-primary/50 dark:hover:border-primary/50"
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-2.5 text-gray-700 dark:text-gray-300">{icon}</div>
          <div className="space-y-1">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <CardDescription className="text-xs line-clamp-1">{description}</CardDescription>
          </div>
        </div>
      </div>
    </Card>
  )
}

