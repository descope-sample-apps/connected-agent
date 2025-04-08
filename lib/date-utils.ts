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
} from "date-fns";

export interface ParsedDate {
  date: Date;
  formattedDate: string;
  formattedTime: string;
  isoString: string;
}

export function parseRelativeDate(
  dateString: string,
  timeString: string,
  baseDate: Date = new Date()
): ParsedDate {
  try {
    // Set base date to midnight to avoid timezone issues
    const base = new Date(baseDate);
    base.setHours(0, 0, 0, 0);

    let targetDate: Date;
    const lowerDateString = dateString.toLowerCase().trim();

    // Handle relative dates
    if (lowerDateString === "today") {
      targetDate = base;
    } else if (lowerDateString === "tomorrow") {
      targetDate = addDays(base, 1);
    } else if (lowerDateString === "next week") {
      targetDate = addWeeks(base, 1);
    } else if (lowerDateString === "next month") {
      targetDate = addMonths(base, 1);
    } else if (lowerDateString === "next year") {
      targetDate = addYears(base, 1);
    }
    // Handle specific days of the week
    else if (lowerDateString.includes("monday") || lowerDateString === "mon") {
      targetDate = nextMonday(base);
    } else if (
      lowerDateString.includes("tuesday") ||
      lowerDateString === "tue"
    ) {
      targetDate = nextTuesday(base);
    } else if (
      lowerDateString.includes("wednesday") ||
      lowerDateString === "wed"
    ) {
      targetDate = nextWednesday(base);
    } else if (
      lowerDateString.includes("thursday") ||
      lowerDateString === "thu"
    ) {
      targetDate = nextThursday(base);
    } else if (
      lowerDateString.includes("friday") ||
      lowerDateString === "fri"
    ) {
      targetDate = nextFriday(base);
    } else if (
      lowerDateString.includes("saturday") ||
      lowerDateString === "sat"
    ) {
      targetDate = nextSaturday(base);
    } else if (
      lowerDateString.includes("sunday") ||
      lowerDateString === "sun"
    ) {
      targetDate = nextSunday(base);
    }
    // Try to parse as a formatted date (YYYY-MM-DD, MM/DD/YYYY, etc.)
    else {
      // Try different date formats
      const formats = ["yyyy-MM-dd", "MM/dd/yyyy", "dd/MM/yyyy", "MMM d, yyyy"];

      let parsedDate: Date | null = null;

      // Try each format until one works
      for (const fmt of formats) {
        try {
          parsedDate = parse(lowerDateString, fmt, base);
          if (isValid(parsedDate)) {
            break;
          }
        } catch (e) {
          // Continue trying other formats
        }
      }

      // If none of the formats worked, try as ISO string
      if (!parsedDate || !isValid(parsedDate)) {
        try {
          parsedDate = parseISO(lowerDateString);
        } catch (e) {
          // Ignore ISO parsing errors
        }
      }

      // If we still don't have a valid date, default to today
      if (!parsedDate || !isValid(parsedDate)) {
        console.warn(
          `Could not parse date string: "${dateString}", defaulting to today`
        );
        parsedDate = base;
      }

      targetDate = parsedDate;
    }

    // Now parse the time
    let hour = 0;
    let minute = 0;

    try {
      // Handle various time formats
      const lowerTimeString = timeString.toLowerCase().trim();

      // Check for AM/PM
      const isPM = lowerTimeString.includes("pm");

      // Try to parse "HH:MM" format first
      if (lowerTimeString.includes(":")) {
        const [hours, minutes] = lowerTimeString.split(":");
        hour = parseInt(hours, 10);
        // Extract just the number part from minutes (in case it includes AM/PM)
        minute = parseInt(minutes.replace(/[^0-9]/g, ""), 10);
      }
      // Handle "X PM" or "X AM" format
      else if (
        lowerTimeString.includes("am") ||
        lowerTimeString.includes("pm")
      ) {
        hour = parseInt(lowerTimeString.replace(/[^0-9]/g, ""), 10);
        minute = 0;
      }
      // Just a number, assume it's the hour
      else if (!isNaN(parseInt(lowerTimeString, 10))) {
        hour = parseInt(lowerTimeString, 10);
        minute = 0;
      }

      // Apply AM/PM conversion
      if (isPM && hour !== 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;

      // Validate hour and minute
      if (isNaN(hour) || hour < 0 || hour > 23) {
        console.warn(
          `Invalid hour in time string "${timeString}", defaulting to 0`
        );
        hour = 0;
      }

      if (isNaN(minute) || minute < 0 || minute > 59) {
        console.warn(
          `Invalid minute in time string "${timeString}", defaulting to 0`
        );
        minute = 0;
      }
    } catch (e) {
      console.error(`Error parsing time string "${timeString}":`, e);
      // Default to midnight if there's an error
      hour = 0;
      minute = 0;
    }

    // Set the time on the target date
    targetDate.setHours(hour, minute, 0, 0);

    return {
      date: targetDate,
      formattedDate: format(targetDate, "MMMM d, yyyy"),
      formattedTime: format(targetDate, "h:mm a"),
      isoString: targetDate.toISOString(),
    };
  } catch (error) {
    console.error("Error in parseRelativeDate:", error);
    // Return the current date/time as a fallback
    const now = new Date();
    return {
      date: now,
      formattedDate: format(now, "MMMM d, yyyy"),
      formattedTime: format(now, "h:mm a"),
      isoString: now.toISOString(),
    };
  }
}

export function getCurrentDateContext(): {
  currentDate: string;
  currentTime: string;
  tomorrow: string;
  nextWeek: string;
} {
  const now = new Date();
  return {
    currentDate: format(now, "MMMM d, yyyy"),
    currentTime: format(now, "h:mm a"),
    tomorrow: format(addDays(now, 1), "MMMM d, yyyy"),
    nextWeek: format(addWeeks(now, 1), "MMMM d, yyyy"),
  };
}
