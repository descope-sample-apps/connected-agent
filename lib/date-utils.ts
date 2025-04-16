import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  parse,
  format,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  nextSunday,
  parseISO,
  isValid,
  setHours,
  setMinutes,
  isBefore,
  startOfDay,
  endOfDay,
  addHours,
} from "date-fns";

export interface ParsedDate {
  date: Date;
  formattedDate: string;
  formattedTime: string;
  isoString: string;
  timezone: string;
}

// Helper function to determine if a time is morning, afternoon, or evening
function getTimeOfDay(timeString: string): { hour: number; minute: number } {
  const lowerTimeString = timeString.toLowerCase();

  // Default times for different parts of the day
  if (lowerTimeString === "morning") return { hour: 9, minute: 0 };
  if (lowerTimeString === "afternoon") return { hour: 14, minute: 0 };
  if (lowerTimeString === "evening") return { hour: 18, minute: 0 };
  if (lowerTimeString === "night") return { hour: 20, minute: 0 };

  return { hour: 12, minute: 0 }; // Default to noon
}

export function parseRelativeDate(
  dateString: string,
  timeString: string = "12:00",
  baseDate: Date = new Date(),
  timezone: string = "UTC"
): {
  date: Date;
  formattedDate: string;
  formattedTime: string;
} {
  console.log(
    `Parsing date: "${dateString}" at time: "${timeString}" with timezone: ${timezone} from base date: ${baseDate.toISOString()}`
  );

  // Create a fresh date object based on the provided baseDate
  const now = new Date(baseDate);

  // Set default time parts
  let hours = 12;
  let minutes = 0;

  // Parse time string (supporting formats like "2pm", "14:00", "2:30 PM")
  if (timeString) {
    // Log the original time string for debugging
    console.log(`Parsing time string: "${timeString}"`);

    // Check for AM/PM format
    const isPM = timeString.toLowerCase().includes("pm");
    const isAM = timeString.toLowerCase().includes("am");

    // Remove AM/PM and trim
    const cleanTimeString = timeString
      .toLowerCase()
      .replace(/am|pm/g, "")
      .trim();

    // Try to extract hours and minutes
    if (cleanTimeString.includes(":")) {
      // Format like "2:30"
      const [hourStr, minuteStr] = cleanTimeString.split(":");
      hours = parseInt(hourStr, 10);
      minutes = parseInt(minuteStr, 10);
    } else {
      // Format like "2" (assume 0 minutes)
      hours = parseInt(cleanTimeString, 10);
      minutes = 0;
    }

    // Adjust for PM if needed (but not for 12 PM which is already correct)
    if (isPM && hours < 12) {
      hours += 12;
    }

    // Adjust for 12 AM which should be 0 hours
    if (isAM && hours === 12) {
      hours = 0;
    }

    console.log(
      `Parsed time components: hours=${hours}, minutes=${minutes}, isPM=${isPM}, isAM=${isAM}`
    );
  }

  // Parse date string for common patterns
  let resultDate = new Date(now);

  // Convert date string to lowercase for easier comparison
  const lowerDateString = dateString.toLowerCase();

  // Handle various date expressions
  if (lowerDateString.includes("today")) {
    // Keep the current date
  } else if (lowerDateString.includes("tomorrow")) {
    resultDate.setDate(resultDate.getDate() + 1);
  } else if (lowerDateString.includes("next week")) {
    resultDate.setDate(resultDate.getDate() + 7);
  } else if (lowerDateString.includes("monday")) {
    resultDate = getNextDayOfWeek(resultDate, 1);
  } else if (lowerDateString.includes("tuesday")) {
    resultDate = getNextDayOfWeek(resultDate, 2);
  } else if (lowerDateString.includes("wednesday")) {
    resultDate = getNextDayOfWeek(resultDate, 3);
  } else if (lowerDateString.includes("thursday")) {
    resultDate = getNextDayOfWeek(resultDate, 4);
  } else if (lowerDateString.includes("friday")) {
    resultDate = getNextDayOfWeek(resultDate, 5);
  } else if (lowerDateString.includes("saturday")) {
    resultDate = getNextDayOfWeek(resultDate, 6);
  } else if (lowerDateString.includes("sunday")) {
    resultDate = getNextDayOfWeek(resultDate, 0);
  } else if (lowerDateString.match(/\d+\/\d+\/\d+/)) {
    // Handle MM/DD/YYYY format
    const [month, day, year] = lowerDateString.split("/").map(Number);
    resultDate.setFullYear(year || resultDate.getFullYear());
    resultDate.setMonth(month - 1);
    resultDate.setDate(day);
  } else if (lowerDateString.match(/\d+-\d+-\d+/)) {
    // Handle YYYY-MM-DD format
    try {
      resultDate = new Date(lowerDateString);
    } catch (e) {
      console.error(`Failed to parse date string: ${lowerDateString}`, e);
    }
  } else {
    try {
      // Try to use the JavaScript Date parser as a fallback
      const parsedDate = new Date(dateString);
      if (!isNaN(parsedDate.getTime())) {
        resultDate = parsedDate;
      } else {
        console.warn(
          `Unrecognized date format: ${dateString}, using current date`
        );
      }
    } catch (e) {
      console.error(`Failed to parse date string: ${dateString}`, e);
    }
  }

  // Set the time components on the result date
  resultDate.setHours(hours, minutes, 0, 0);

  // Log what we've parsed before any timezone adjustments
  console.log(
    `Parsed date before timezone adjustment: ${resultDate.toISOString()}`
  );

  // Format the date as an ISO string with timezone offset for Google Calendar
  // This is a crucial fix - we create a timezone-aware ISO string that doesn't lose the intended time
  let isoString = "";

  try {
    // Use the date-fns library if available for timezone handling
    // Otherwise, format manually with proper timezone designation
    const year = resultDate.getFullYear();
    const month = String(resultDate.getMonth() + 1).padStart(2, "0");
    const day = String(resultDate.getDate()).padStart(2, "0");
    const hour = String(hours).padStart(2, "0");
    const minute = String(minutes).padStart(2, "0");

    // Format the date in YYYY-MM-DDThh:mm:00 format and append the timezone
    // We do NOT use toISOString() here because that would convert to UTC
    isoString = `${year}-${month}-${day}T${hour}:${minute}:00`;

    // If timezone is not UTC, append the timezone identifier
    if (timezone !== "UTC") {
      isoString = `${isoString}`; // The API will use the timezone parameter
      console.log(
        `Created timezone-aware ISO string: ${isoString} with timezone: ${timezone}`
      );
    } else {
      isoString = `${isoString}Z`; // UTC timezone gets the Z suffix
    }
  } catch (e) {
    console.error("Error creating timezone-aware ISO string:", e);
    // Fallback to regular ISO string if there's an error
    isoString = resultDate.toISOString();
  }

  // For display purposes, we still want to show the date and time according to the timezone
  const month = resultDate.toLocaleString("en-US", {
    month: "long",
    timeZone: timezone,
  });
  const day = resultDate.getDate();
  const year = resultDate.getFullYear();
  const formattedDate = `${month} ${day}, ${year}`;

  // Format the time part for display, properly accounting for timezone
  const formattedTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(resultDate);

  // Log the final parsed result
  console.log(
    `Final parsed result: date=${formattedDate}, time=${formattedTime}, ISO=${isoString}, timezone=${timezone}`
  );

  // Store the ISO string in the date object using a custom property
  const dateWithTimezone = new Date(resultDate);
  (dateWithTimezone as any).isoStringWithTimezone = isoString;
  (dateWithTimezone as any).timezone = timezone;

  return {
    date: dateWithTimezone,
    formattedDate,
    formattedTime,
  };
}

// Helper function to get the next occurrence of a day of the week
function getNextDayOfWeek(date: Date, dayOfWeek: number): Date {
  const resultDate = new Date(date.getTime());
  resultDate.setDate(
    date.getDate() + ((7 + dayOfWeek - date.getDay()) % 7) || 7
  );
  return resultDate;
}

export function getCurrentDateContext() {
  const now = new Date();

  // Create an object with current date information
  return {
    currentDate: now.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    currentTime: now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    tomorrow: new Date(now.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString(
      "en-US",
      { month: "long", day: "numeric", year: "numeric" }
    ),
    nextWeek: new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000
    ).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    timestamp: now.toISOString(),
  };
}
