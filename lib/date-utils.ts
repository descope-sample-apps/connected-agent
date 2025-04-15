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
  baseDate: Date = new Date()
): ParsedDate {
  try {
    // Set base date to start of day to avoid timezone issues
    const base = startOfDay(new Date(baseDate));

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
    // Handle days of the week with "this" or "next"
    else if (lowerDateString.includes("monday") || lowerDateString === "mon") {
      targetDate = lowerDateString.includes("this")
        ? nextMonday(addDays(base, -7))
        : nextMonday(base);
    } else if (
      lowerDateString.includes("tuesday") ||
      lowerDateString === "tue"
    ) {
      targetDate = lowerDateString.includes("this")
        ? nextTuesday(addDays(base, -7))
        : nextTuesday(base);
    } else if (
      lowerDateString.includes("wednesday") ||
      lowerDateString === "wed"
    ) {
      targetDate = lowerDateString.includes("this")
        ? nextWednesday(addDays(base, -7))
        : nextWednesday(base);
    } else if (
      lowerDateString.includes("thursday") ||
      lowerDateString === "thu"
    ) {
      targetDate = lowerDateString.includes("this")
        ? nextThursday(addDays(base, -7))
        : nextThursday(base);
    } else if (
      lowerDateString.includes("friday") ||
      lowerDateString === "fri"
    ) {
      targetDate = lowerDateString.includes("this")
        ? nextFriday(addDays(base, -7))
        : nextFriday(base);
    } else if (
      lowerDateString.includes("saturday") ||
      lowerDateString === "sat"
    ) {
      targetDate = lowerDateString.includes("this")
        ? nextSaturday(addDays(base, -7))
        : nextSaturday(base);
    } else if (
      lowerDateString.includes("sunday") ||
      lowerDateString === "sun"
    ) {
      targetDate = lowerDateString.includes("this")
        ? nextSunday(addDays(base, -7))
        : nextSunday(base);
    }
    // Try to parse as a formatted date
    else {
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
      const lowerTimeString = timeString.toLowerCase().trim();

      // Handle time of day descriptions
      if (
        ["morning", "afternoon", "evening", "night"].includes(lowerTimeString)
      ) {
        const timeOfDay = getTimeOfDay(lowerTimeString);
        hour = timeOfDay.hour;
        minute = timeOfDay.minute;
      }
      // Handle AM/PM format
      else if (lowerTimeString.includes(":")) {
        const isPM = lowerTimeString.includes("pm");
        const [hours, minutes] = lowerTimeString.split(":");
        hour = parseInt(hours, 10);
        minute = parseInt(minutes.replace(/[^0-9]/g, ""), 10);

        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
      }
      // Handle "X PM" or "X AM" format
      else if (
        lowerTimeString.includes("am") ||
        lowerTimeString.includes("pm")
      ) {
        const isPM = lowerTimeString.includes("pm");
        hour = parseInt(lowerTimeString.replace(/[^0-9]/g, ""), 10);
        minute = 0;

        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
      }
      // Just a number, assume it's the hour
      else if (!isNaN(parseInt(lowerTimeString, 10))) {
        hour = parseInt(lowerTimeString, 10);
        // If hour is between 1-7, assume PM
        if (hour >= 1 && hour <= 7) hour += 12;
        minute = 0;
      }

      // Validate hour and minute
      if (isNaN(hour) || hour < 0 || hour > 23) {
        console.warn(
          `Invalid hour in time string "${timeString}", defaulting to 12`
        );
        hour = 12;
      }

      if (isNaN(minute) || minute < 0 || minute > 59) {
        console.warn(
          `Invalid minute in time string "${timeString}", defaulting to 0`
        );
        minute = 0;
      }
    } catch (e) {
      console.error(`Error parsing time string "${timeString}":`, e);
      // Default to noon if there's an error
      hour = 12;
      minute = 0;
    }

    // Set the time on the target date
    targetDate = setHours(setMinutes(targetDate, minute), hour);

    // If the resulting date is in the past, add appropriate time
    if (isBefore(targetDate, new Date())) {
      if (lowerDateString.includes("today")) {
        // If it's today but the time is past, default to 1 hour from now
        targetDate = addHours(new Date(), 1);
      } else if (
        !lowerDateString.includes("this") &&
        !lowerDateString.includes("last")
      ) {
        // For other dates in the past, assume next occurrence
        targetDate = addWeeks(targetDate, 1);
      }
    }

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
