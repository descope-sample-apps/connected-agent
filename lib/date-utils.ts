import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  parse,
  format,
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
  // Set base date to midnight to avoid timezone issues
  const base = new Date(baseDate);
  base.setHours(0, 0, 0, 0);

  let targetDate: Date;

  // Handle relative dates
  if (dateString.toLowerCase() === "today") {
    targetDate = base;
  } else if (dateString.toLowerCase() === "tomorrow") {
    targetDate = addDays(base, 1);
  } else if (dateString.toLowerCase() === "next week") {
    targetDate = addWeeks(base, 1);
  } else if (dateString.toLowerCase() === "next month") {
    targetDate = addMonths(base, 1);
  } else if (dateString.toLowerCase() === "next year") {
    targetDate = addYears(base, 1);
  } else {
    // Try to parse the date string
    targetDate = parse(dateString, "yyyy-MM-dd", base);
  }

  // Parse the time
  const [hours, minutes] = timeString.split(":");
  const isPM = timeString.toLowerCase().includes("pm");
  let hour = parseInt(hours);
  if (isPM && hour !== 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;

  // Set the time on the target date
  targetDate.setHours(hour, parseInt(minutes), 0, 0);

  return {
    date: targetDate,
    formattedDate: format(targetDate, "MMMM d, yyyy"),
    formattedTime: format(targetDate, "h:mm a"),
    isoString: targetDate.toISOString(),
  };
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
