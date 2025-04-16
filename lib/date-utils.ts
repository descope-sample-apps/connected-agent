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
): ParsedDate {
  try {
    // Always create a fresh current date if the provided date seems stale
    // In javascript, a day in milliseconds is 86400000
    const currentDate = new Date();
    const ONE_DAY_MS = 86400000;

    // If baseDate is more than 12 hours old, use the current date instead
    if (currentDate.getTime() - baseDate.getTime() > ONE_DAY_MS / 2) {
      console.warn(
        "Base date is more than 12 hours old, using current date instead.",
        {
          providedBase: baseDate.toISOString(),
          currentDate: currentDate.toISOString(),
        }
      );
      baseDate = currentDate;
    }

    // Log the base date for debugging
    console.log(
      `Date parsing base date: ${baseDate.toISOString()}, timezone: ${timezone}`
    );

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
      console.log(
        `Parsed "next week" as: ${targetDate.toISOString()} in timezone: ${timezone}`
      );
    } else if (lowerDateString === "next month") {
      targetDate = addMonths(base, 1);
    } else if (lowerDateString === "next year") {
      targetDate = addYears(base, 1);
    }
    // Handle days of the week with "this", "next", or "next week"
    else if (lowerDateString.includes("monday") || lowerDateString === "mon") {
      if (lowerDateString.includes("next week")) {
        // For "next week monday", add 1 week to the next Monday
        targetDate = addWeeks(nextMonday(base), 1);
      } else {
        targetDate = lowerDateString.includes("this")
          ? nextMonday(addDays(base, -7))
          : nextMonday(base);
      }
    } else if (
      lowerDateString.includes("tuesday") ||
      lowerDateString === "tue"
    ) {
      if (lowerDateString.includes("next week")) {
        // For "next week tuesday", add 1 week to the next Tuesday
        targetDate = addWeeks(nextTuesday(base), 1);
      } else {
        targetDate = lowerDateString.includes("this")
          ? nextTuesday(addDays(base, -7))
          : nextTuesday(base);
      }
    } else if (
      lowerDateString.includes("wednesday") ||
      lowerDateString === "wed"
    ) {
      if (lowerDateString.includes("next week")) {
        // For "next week wednesday", add 1 week to the next Wednesday
        targetDate = addWeeks(nextWednesday(base), 1);
      } else {
        targetDate = lowerDateString.includes("this")
          ? nextWednesday(addDays(base, -7))
          : nextWednesday(base);
      }
    } else if (
      lowerDateString.includes("thursday") ||
      lowerDateString === "thu"
    ) {
      if (lowerDateString.includes("next week")) {
        // For "next week thursday", add 1 week to the next Thursday
        targetDate = addWeeks(nextThursday(base), 1);
      } else {
        targetDate = lowerDateString.includes("this")
          ? nextThursday(addDays(base, -7))
          : nextThursday(base);
      }
    } else if (
      lowerDateString.includes("friday") ||
      lowerDateString === "fri"
    ) {
      if (lowerDateString.includes("next week")) {
        // For "next week friday", add 1 week to the next Friday
        targetDate = addWeeks(nextFriday(base), 1);
      } else {
        targetDate = lowerDateString.includes("this")
          ? nextFriday(addDays(base, -7))
          : nextFriday(base);
      }
    } else if (
      lowerDateString.includes("saturday") ||
      lowerDateString === "sat"
    ) {
      if (lowerDateString.includes("next week")) {
        // For "next week saturday", add 1 week to the next Saturday
        targetDate = addWeeks(nextSaturday(base), 1);
      } else {
        targetDate = lowerDateString.includes("this")
          ? nextSaturday(addDays(base, -7))
          : nextSaturday(base);
      }
    } else if (
      lowerDateString.includes("sunday") ||
      lowerDateString === "sun"
    ) {
      if (lowerDateString.includes("next week")) {
        // For "next week sunday", add 1 week to the next Sunday
        targetDate = addWeeks(nextSunday(base), 1);
      } else {
        targetDate = lowerDateString.includes("this")
          ? nextSunday(addDays(base, -7))
          : nextSunday(base);
      }
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
      timezone: timezone,
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
      timezone: "UTC",
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
