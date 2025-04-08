import { z } from "zod";
import { getCRMToken } from "@/lib/descope";

export const getCRMData = {
  description: "Get customer information from the CRM",
  parameters: z.object({
    customerName: z
      .string()
      .describe("The name of the customer or company to look up"),
  }),
  execute: async ({
    customerName,
    userId,
  }: {
    customerName: string;
    userId: string;
  }) => {
    console.log(`Accessing CRM data for: ${customerName}, userId: ${userId}`);

    try {
      // Check CRM connection
      const crmToken = await getCRMToken(userId);
      if (!crmToken || "error" in crmToken) {
        return {
          success: false,
          error: "To search for customers, please connect your CRM first.",
          needsConnection: true,
          provider: "custom-crm",
        };
      }

      // Implement actual CRM lookup here
      // For now, return mock data
      return {
        success: true,
        customer: {
          name: customerName,
          contactEmail: "contact@example.com",
          phone: "555-123-4567",
          company: "Example Corp",
          lastContact: "2023-12-15",
          status: "Active",
          deals: [
            {
              id: "deal-123",
              title: "Product Expansion",
              value: 75000,
              stage: "Negotiation",
              probability: 0.75,
              expectedCloseDate: "2024-06-30",
            },
          ],
        },
      };
    } catch (error) {
      console.error("Error getting CRM data:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get CRM data",
      };
    }
  },
};
