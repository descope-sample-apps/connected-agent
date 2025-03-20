"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, Users } from "lucide-react";

interface CalendarEvent {
  title: string;
  date: string;
  time: string;
  duration: string;
  location?: string;
  attendees?: string[];
}

interface InChatCalendarEventProps {
  event: CalendarEvent;
}

export default function InChatCalendarEvent({
  event,
}: InChatCalendarEventProps) {
  return (
    <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-base">{event.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{event.date}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {event.time} ({event.duration})
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{event.location}</span>
            </div>
          )}
          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                {event.attendees.map((attendee, index) => (
                  <div key={index} className="text-sm">
                    {attendee}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
