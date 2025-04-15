# Connected Agent

A powerful, extensible AI-powered CRM assistant built with Next.js and Descope for secure authentication and OAuth management.

![CRM Assistant](public/logos/crm-logo.png)

## Overview

CRM Assistant is a modern, AI-powered application that helps users manage their customer relationships more effectively. It integrates with various third-party services like Google Calendar, Google Docs, Google Meet, and custom CRM systems to provide a seamless experience for managing contacts, deals, and communications.

The application is built with Next.js and uses Descope for authentication and OAuth token management, making it secure and easy to extend with additional functionality.

## Key Features

- **AI-Powered Conversations**: Natural language interface for interacting with your CRM data
- **OAuth Integration**: Connect to multiple services (Google Calendar, Google Docs, Google Meet, Slack, etc.)
- **Progressive Scoping**: Automatically request additional permissions as needed
- **Usage Tracking**: Monitor and limit usage with built-in analytics
- **Extensible Tool Registry**: Easily add new tools and capabilities
- **Secure Token Management**: Descope handles OAuth tokens securely
- **Modern UI**: Built with Tailwind CSS and Radix UI components

## Architecture

### Authentication & Authorization

The application uses Descope for authentication and authorization. Descope provides:

- User authentication (sign-up, sign-in, password reset)
- Session management
- OAuth token management through Outbound Apps

### OAuth Integration

The application uses Descope's Outbound Apps feature to securely manage OAuth tokens for various providers:

- Google Calendar
- Google Docs
- Google Meet
- Slack
- Custom CRM

Outbound Apps provide a secure way to store and manage OAuth tokens, with automatic token refresh and scope management.

### Tool Registry

The application includes a registry of tools that can be used by the AI to perform various actions:

- Calendar management (schedule meetings, check availability)
- Document creation and management
- CRM operations (contacts, deals, activities)
- Meeting scheduling
- Weather information
- Date parsing and formatting

Each tool is defined with a clear interface and can be easily extended or modified.

### Progressive Scoping

The application implements progressive scoping, which means it only requests the permissions it needs for a specific operation. For example:

1. When a user first connects to Google Calendar, it requests basic calendar access
2. If the user later tries to schedule a meeting, it automatically requests additional permissions
3. The application tracks which permissions have been granted and only requests new ones as needed

This approach improves the user experience by minimizing permission requests and only asking for what's necessary.

### OpenAPI Integration

The application can fetch scopes from OpenAPI specifications for supported providers:

- Google Calendar
- Google Docs
- Google Drive
- Zoom

This allows for automatic scope determination based on the API operations being performed.

### Analytics & Usage Tracking

The application includes built-in analytics and usage tracking:

- OAuth connection events
- Tool usage
- Error tracking
- User activity

Analytics can be sent to PostHog or any other analytics provider by configuring the appropriate environment variables.

### Database

The application uses PostgreSQL for data storage, with Drizzle ORM for database operations. The database schema includes:

- Usage tracking
- Chat history
- User preferences

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Descope account and project

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/crm-assistant.git
   cd crm-assistant
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env.local
   ```

4. Configure your environment variables in `.env.local`:

   ```
   # Descope
   NEXT_PUBLIC_DESCOPE_PROJECT_ID=your-project-id
   DESCOPE_MANAGEMENT_KEY=your-management-key

   # Database
   DATABASE_URL=postgres://username:password@localhost:5432/crm_assistant

   # Analytics (optional)
   NEXT_PUBLIC_POSTHOG_KEY=your-posthog-key
   NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

   # API Keys
   CRM_API_KEY=your-crm-api-key
   ```

5. Run database migrations:

   ```bash
   npm run migrate
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Extending the Application

### Adding New Tools

To add a new tool to the application:

1. Create a new file in `lib/ai/tools/` with your tool implementation
2. Define the tool interface using Zod for parameter validation
3. Implement the tool's functionality
4. Register the tool in the appropriate registry

Example:

```typescript
// lib/ai/tools/my-tool.ts
import { z } from "zod";

export function myTool({
  userId,
  dataStream,
}: {
  userId: string;
  dataStream: DataStreamProps;
}) {
  return {
    description: "Description of what the tool does",
    parameters: z.object({
      param1: z.string().describe("Description of param1"),
      param2: z.number().describe("Description of param2"),
    }),
    execute: async ({ param1, param2 }) => {
      // Tool implementation
      return {
        success: true,
        result: "Tool execution result",
      };
    },
  };
}
```

### Adding New OAuth Providers

To add a new OAuth provider:

1. Configure the provider in your Descope project
2. Add the provider to the `DEFAULT_SCOPES` in `lib/oauth-utils.ts`
3. Add the provider to the `specUrls` in `lib/openapi-utils.ts` if it has an OpenAPI spec
4. Add the provider to the connections list in the UI

### Using Different LLM Models

The application supports multiple LLM providers through the AI SDK:

- OpenAI
- Anthropic
- Groq

To use a different model:

1. Configure the model in your environment variables
2. Update the model configuration in `lib/ai/models.ts`

### Connecting to a Different Database

The application uses Drizzle ORM, which supports multiple databases. To use a different database:

1. Update the `DATABASE_URL` in your environment variables
2. Modify the database configuration in `lib/db/migrate.ts` if needed

## Descope Outbound Apps

Descope Outbound Apps provide a secure way to manage OAuth tokens for third-party services. In this application, they are used to:

1. Securely store OAuth tokens
2. Automatically refresh expired tokens
3. Manage token scopes
4. Associate tokens with specific users

### How Outbound Apps Work

1. When a user connects to a service (e.g., Google Calendar), the application redirects them to the service's OAuth page
2. After authorization, the service redirects back to the application with an authorization code
3. The application sends the code to Descope, which exchanges it for access and refresh tokens
4. Descope securely stores the tokens and associates them with the user
5. When the application needs to make API calls, it requests the token from Descope
6. Descope handles token refresh automatically when tokens expire

This approach ensures that:

- Tokens are stored securely
- Token refresh is handled automatically
- Tokens are associated with specific users
- The application never directly handles sensitive tokens

## Analytics Integration

The application includes built-in analytics tracking for:

- OAuth connections and disconnections
- Tool usage
- Errors
- User activity

To use your own analytics provider:

1. Update the analytics configuration in `lib/analytics.ts`
2. Set the appropriate environment variables

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Next.js](https://nextjs.org/)
- [Descope](https://www.descope.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [PostgreSQL](https://www.postgresql.org/)
- [OpenAI](https://openai.com/)
- [Anthropic](https://www.anthropic.com/)
- [Groq](https://groq.com/)
