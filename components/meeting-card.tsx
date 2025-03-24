import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, Users } from "lucide-react";

interface MeetingCardProps {
  message: string;
  link: {
    text: string;
    url: string;
  };
  details: {
    title: string;
    date: string;
    time: string;
    attendees: string[];
  };
}

export function MeetingCard({ message, link, details }: MeetingCardProps) {
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{details.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{message}</p>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            <span>{details.date}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            <span>{details.time}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            <span>{details.attendees.join(", ")}</span>
          </div>
        </div>

        <Button asChild className="w-full" variant="default">
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            {link.text}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
