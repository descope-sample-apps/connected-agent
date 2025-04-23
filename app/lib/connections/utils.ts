export function createConnectionRequest(
  service: string,
  message?: string,
  extraData?: any
) {
  console.log(
    "[createConnectionRequest] Creating connection request for service:",
    service
  );

  // Map service name to friendly display name
  const serviceDisplayNames: { [key: string]: string } = {
    "custom-crm": "CRM",
    "google-calendar": "Google Calendar",
    "google-meet": "Google Meet",
    "google-mail": "Gmail",
  };

  const displayName = serviceDisplayNames[service] || service;
  const defaultMessage = `${displayName} access is required to continue.`;

  // Creating a more standardized format that will be detected reliably
  const response = {
    success: false,
    status: "error",
    error: `${displayName} connection required`,
    hasUI: true,
    uiType: "connection_required",
    service: service,
    message: message || defaultMessage,
    buttonText: `Connect ${displayName}`,
    buttonAction: `connection://${service}`,
    hasRequiredScopes: true,
    alternativeMessage: `This will allow the assistant to access your ${displayName} data.`,
    ...(extraData || {}),
    // Also include the UI element in the standard format for compatibility
    ui: {
      type: "connection_required",
      service: service,
      message: message || defaultMessage,
      connectButton: {
        text: `Connect ${displayName}`,
        action: `connection://${service}`,
      },
      alternativeMessage: `This will allow the assistant to access your ${displayName} data.`,
      requiredScopes:
        service === "google-meet"
          ? [
              "https://www.googleapis.com/auth/calendar",
              "https://www.googleapis.com/auth/meetings.space.created",
            ]
          : [],
      ...(extraData?.ui || {}),
    },
  };

  console.log("[createConnectionRequest] Created response:", response);
  return response;
}
