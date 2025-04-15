import { z } from "zod";

export const getWeather = {
  description: "Get the current weather for a location",
  parameters: z.object({
    location: z
      .string()
      .describe("The city and/or country to get the weather for"),
  }),
  execute: async ({ location }: { location: string }) => {
    console.log(`Getting weather for ${location}`);

    try {
      // This is a mock implementation - in a real app, you would call a weather API
      // like OpenWeatherMap, WeatherAPI, etc.

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Sample data based on location
      const weatherData = {
        location,
        temperature: Math.round(15 + Math.random() * 15), // Random temp between 15-30°C
        condition: ["Sunny", "Partly Cloudy", "Cloudy", "Rainy"][
          Math.floor(Math.random() * 4)
        ],
        humidity: Math.round(60 + Math.random() * 30), // Random humidity between 60-90%
        wind: Math.round(5 + Math.random() * 20), // Random wind speed between 5-25 km/h
      };

      return {
        success: true,
        weather: weatherData,
      };
    } catch (error) {
      console.error("Error getting weather:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get weather data",
      };
    }
  },
};
