// Tool action result type for UI rendering
export interface ToolActionResult {
  success: boolean;
  action: string;
  provider?: string;
  details: any;
  timestamp: string;
  requiresConnection?: boolean;
  connectionType?: string;
  ui?: {
    type: string;
    service?: string;
    message?: string;
    connectButton?: {
      text: string;
      action: string;
    };
    alternativeMessage?: string;
  };
}

// Calendar Event type for the Google Calendar API
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{email: string}>;
  htmlLink?: string;
}

// Contact type for CRM data
export interface Contact {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
}
