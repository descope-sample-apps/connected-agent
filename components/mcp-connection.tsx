import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface MCPTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

interface MCPConnectionProps {
  onConnect: (serverUrl: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
  tools: MCPTool[];
  isConnected: boolean;
  isLoading: boolean;
}

export function MCPConnection({
  onConnect,
  onDisconnect,
  tools,
  isConnected,
  isLoading,
}: MCPConnectionProps) {
  const [serverUrl, setServerUrl] = useState("");

  const handleConnect = async () => {
    if (serverUrl) {
      await onConnect(serverUrl);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>MCP Server Connection</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter MCP server URL"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              disabled={isConnected}
            />
            <Button
              onClick={handleConnect}
              disabled={isConnected || isLoading || !serverUrl}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isConnected ? (
                "Connected"
              ) : (
                "Connect"
              )}
            </Button>
          </div>

          {isConnected && (
            <Button
              variant="destructive"
              onClick={onDisconnect}
              className="w-full"
            >
              Disconnect
            </Button>
          )}

          {isConnected && tools.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Available Tools</h3>
              <ScrollArea className="h-[200px] rounded-md border p-4">
                <div className="space-y-4">
                  {tools.map((tool) => (
                    <div key={tool.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">{tool.name}</h4>
                        <Badge variant="secondary">MCP Tool</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {tool.description}
                      </p>
                      <div className="text-xs text-muted-foreground">
                        <p>Required parameters:</p>
                        <ul className="list-disc pl-4">
                          {tool.parameters.required.map((param) => (
                            <li key={param}>{param}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
