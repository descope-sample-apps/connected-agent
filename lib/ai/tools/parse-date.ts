import { z } from "zod";
import { parseRelativeDate, getCurrentDateContext } from "@/lib/date-utils";

export const parseDate = {
  description: "Parse a relative date into a formatted date and time",
  parameters: z.object({
    dateString: z
      .string()
      .describe('The date string to parse (e.g., "tomorrow", "next Friday")'),
    timeString: z
      .string()
      .optional()
      .describe('The time string to parse (e.g., "3pm", "15:00")'),
  }),
  execute: async ({
    dateString,
    timeString = "12:00",
  }: {
    dateString: string;
    timeString?: string;
  }) => {
    try {
      console.log(`Parsing date: "${dateString}" at time: "${timeString}"`);

      const dateContext = getCurrentDateContext();
      const parsedDate = parseRelativeDate(dateString, timeString);

      return {
        success: true,
        dateContext,
        parsedDate,
      };
    } catch (error) {
      console.error(
        `Error parsing date: "${dateString}" at time "${timeString}"`,
        error
      );

      // Use current date as fallback
      const now = new Date();
      return {
        success: false,
        error: `Could not parse date: ${dateString}`,
        fallbackDate: now.toISOString(),
        dateContext: getCurrentDateContext(),
      };
    }
  },
};
