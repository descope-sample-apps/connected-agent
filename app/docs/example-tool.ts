/**
 * Example Tool Implementation
 *
 * This is a sample file that shows how to implement a custom tool for the CRM Assistant.
 * Use this as a reference for creating your own tools.
 */

import { Tool, ToolCallInput, ToolCallOutput } from "../../lib/base-tool";
import { getOAuthToken } from "../../lib/oauth";

/**
 * CompanyInfoTool - A tool that fetches company information from a hypothetical API
 *
 * This example demonstrates:
 * 1. Tool structure with config, validate, and execute methods
 * 2. OAuth token handling
 * 3. Error handling and response formatting
 */
export class CompanyInfoTool extends Tool {
  /**
   * Define the tool configuration
   * This establishes the tool's name, description, and parameters
   */
  config() {
    return {
      name: "get_company_info",
      description:
        "Fetch detailed information about a company using its name or domain",
      parameters: {
        type: "object",
        properties: {
          company: {
            type: "string",
            description:
              "Company name or domain (e.g., 'Acme Inc' or 'acme.com')",
          },
          include_financials: {
            type: "boolean",
            description:
              "Whether to include financial information in the results",
          },
          year: {
            type: "number",
            description:
              "Optional: Specific year for financial data (defaults to current year)",
          },
        },
        required: ["company"],
      },
    };
  }

  /**
   * Validate the input parameters
   * Return true if the input is valid, false otherwise
   */
  validate(input: ToolCallInput): boolean {
    // Check if required parameters are present and valid
    if (
      !input.parameters.company ||
      typeof input.parameters.company !== "string"
    ) {
      return false;
    }

    // Validate optional parameters if provided
    if (
      input.parameters.year !== undefined &&
      (typeof input.parameters.year !== "number" ||
        input.parameters.year < 1900)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Execute the tool functionality
   * This is where the actual work happens
   */
  async execute(input: ToolCallInput): Promise<ToolCallOutput> {
    try {
      // 1. Extract parameters from the input
      const {
        company,
        include_financials = false,
        year = new Date().getFullYear(),
      } = input.parameters;

      // 2. For APIs that require OAuth, get the token
      // This is commented out since this is just a demo
      /*
      const token = await getOAuthToken({
        appId: "company-data-provider",
        scopes: ["companies.read", include_financials ? "financials.read" : ""]
      });
      */

      // 3. Make API call to the external service
      // Simulated API call for demonstration
      const companyData = await this.fetchCompanyData(
        company,
        include_financials,
        year
      );

      // 4. Format and return the response
      return {
        content: JSON.stringify({
          company: companyData.name,
          website: companyData.website,
          description: companyData.description,
          founded: companyData.founded,
          headquarters: companyData.headquarters,
          industry: companyData.industry,
          employees: companyData.employees,
          ...(include_financials && { financials: companyData.financials }),
        }),
      };
    } catch (error) {
      // 5. Handle errors properly
      if (error.code === "token_not_found") {
        // OAuth connection needed
        return {
          error: "Company data access requires authentication.",
          metadata: {
            needsConnection: true,
            service: "company-data-provider",
          },
        };
      } else if (error.code === "company_not_found") {
        // Handle specific error cases
        return {
          error: `Could not find information for company: ${input.parameters.company}`,
        };
      } else {
        // General error case
        console.error("Company info tool error:", error);
        return {
          error: `Error fetching company information: ${error.message}`,
        };
      }
    }
  }

  /**
   * Helper method to fetch company data
   * In a real implementation, this would call an actual API
   */
  private async fetchCompanyData(
    companyQuery: string,
    includeFinancials: boolean,
    year: number
  ) {
    // This is a simulated response for demonstration purposes
    // In a real implementation, you would make an actual API call here

    // Simulate a network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // For demo, we'll just return mock data
    return {
      name: companyQuery.includes(".com")
        ? companyQuery.replace(".com", " Inc")
        : companyQuery,
      website: companyQuery.includes(".com")
        ? `https://${companyQuery}`
        : `https://${companyQuery.toLowerCase().replace(/\s+/g, "")}.com`,
      description: `${companyQuery} is a leading provider of innovative solutions in their industry.`,
      founded: 2005,
      headquarters: "San Francisco, CA",
      industry: "Technology",
      employees: 1200,
      financials: includeFinancials
        ? {
            year: year,
            revenue: "$24.5M",
            growth: "12.3%",
            funding: "$8.7M Series B",
          }
        : undefined,
    };
  }
}

/**
 * Tool registration example
 *
 * In a real implementation, you would add this to lib/tools/index.ts:
 *
 * import { CompanyInfoTool } from './company-info';
 *
 * // Get existing registry
 * export const toolRegistry = getToolRegistry();
 *
 * // Register the tool
 * toolRegistry.register(new CompanyInfoTool());
 */
