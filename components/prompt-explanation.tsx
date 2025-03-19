"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, ExternalLink, Info, Lock, ArrowRight } from "lucide-react"
import Image from "next/image"

interface PromptExplanationProps {
  title: string
  description: string
  steps: {
    title: string
    description: string
  }[]
  apis: string[]
  isVisible: boolean
  onToggle: () => void
}

export default function PromptExplanation({
  title,
  description,
  steps,
  apis,
  isVisible,
  onToggle,
}: PromptExplanationProps) {
  return (
    <div className="mb-4">
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="w-full flex justify-between items-center mb-2 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center">
          <Info className="h-4 w-4 mr-2 text-primary" />
          <span>Explained Prompt: {title}</span>
        </div>
        {isVisible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {isVisible && (
        <Card className="mb-4 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-0">
            <div className="flex flex-wrap gap-2 mb-2">
              {apis.map((api, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                >
                  <Lock className="h-3 w-3 mr-1" /> {api}
                </Badge>
              ))}
            </div>

            {/* Visual diagram of the process */}
            <div className="relative w-full h-48 bg-gray-50 dark:bg-gray-800/50 rounded-md overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full max-w-md">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-2">
                        <Image
                          src="/placeholder.svg?height=40&width=40"
                          alt="User"
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      </div>
                      <span className="text-xs font-medium">User</span>
                    </div>

                    <ArrowRight className="h-5 w-5 text-gray-400" />

                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                        <Image
                          src="/placeholder.svg?height=40&width=40"
                          alt="Sales Assistant"
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      </div>
                      <span className="text-xs font-medium">Assistant</span>
                    </div>

                    <ArrowRight className="h-5 w-5 text-gray-400" />

                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-2">
                        <Image
                          src="/placeholder.svg?height=40&width=40"
                          alt="Google Calendar"
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      </div>
                      <span className="text-xs font-medium">Google API</span>
                    </div>
                  </div>

                  <div className="w-full h-0.5 bg-gray-200 dark:bg-gray-700 my-4"></div>

                  <div className="flex justify-center">
                    <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-xs font-medium">
                      Secure OAuth Connection
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium">How it works</h4>
              <ol className="space-y-3">
                {steps.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-medium text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{step.title}</p>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <Button variant="link" size="sm" className="h-auto p-0 text-primary">
                Learn more about API integrations <ExternalLink className="h-3 w-3 ml-1" />
              </Button>

              <div className="flex gap-2">
                {apis.map((api, index) => (
                  <div
                    key={index}
                    className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center"
                  >
                    <Image
                      src={`/placeholder.svg?height=20&width=20&text=${api.charAt(0)}`}
                      alt={api}
                      width={20}
                      height={20}
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

