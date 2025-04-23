# 🧠 ConnectedAgent – AI-Powered CRM Integration Platform

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/descope-sample-apps/connected-agent)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdescope-sample-apps%2Fconnected-agent&env=NEXT_PUBLIC_DESCOPE_PROJECT_ID,DESCOPE_MANAGEMENT_KEY,DESCOPE_BASE_URL,OPENAI_API_KEY,DATABASE_URL&envDescription=Descope%20Variables%20needed%20for%20Outbound%20Apps%2C%20OpenAI%20key%20is%20for%20the%20LLM%2C%20the%20Database%20URL%20is%20for%20chat%20history%2C%20and%20the%20rest%20is%20optional&project-name=connected-agent&repository-name=connected-agent)

---

## 📌 Overview

**ConnectedAgent** is a powerful showcase of **Descope's Outbound Apps**, enabling secure, AI-driven interactions with CRM systems and business tools. It’s designed as both a reference implementation and a customizable foundation for production apps.

## What is ConnectedAgent?

ConnectedAgent is a modern, secure, AI-driven integration platform designed to help users connect to their favorite business tools, interact with them through natural language, and perform real-time actions—like scheduling meetings, managing contacts, and analyzing deals—all from one intelligent interface.

At its core, ConnectedAgent is a reference implementation for developers building:

- **AI-powered CRM assistants**
- **Secure third-party OAuth integrations**
- **Tool-calling agents that manage user tokens and scopes**

It leverages Descope’s Outbound and Inbound Apps architecture, enabling secure identity and access delegation to and from third-party platforms.

## 🚀 Key Features

### Core Capabilities

- 🤖 **AI Conversations** — Natural language interface for CRM workflows
- 🔄 **OAuth Integration** — Secure connections to external services
- 🧠 **Progressive Scoping** — Request only the permissions you need, when you need them
- 📊 **Analytics** — Monitor usage and performance
- 🛠️ **Extensibility** — Easily add your own tools and services

### Supported Integrations

- 📊 **10xCRM** (via Inbound Apps)
- 📅 **Google Calendar**
- 🎥 **Google Meet**

## ⚙️ Architecture

### Authentication & Authorization

- 🔐 **User Authentication** via Descope
- 🔑 **OAuth Token Handling** with Descope Outbound Apps

### Integration Layers

1. **Outbound Apps** – Securely connect to third-party tools
2. **Inbound Apps** – Accept connections from apps like 10xCRM
3. **Tool Registry** – Modular architecture for dynamic tool loading

## 🌐 Inbound vs. Outbound Apps

ConnectedAgent actually demonstrates both Outbound and Inbound Apps with Descope, but with Inbound Apps from the perspective of the OAuth client.

For more context on what each of these are, here is a brief overview:

### Outbound Apps

Let your app connect **to third-party services** on behalf of the user.

- Example: Get a user’s Google Calendar events
- Securely stores and refreshes tokens
- Grants only requested scopes

### Inbound Apps

Let **third-party apps connect to you** using OAuth.

- Example: Your application integrating with ConnectedAgent as an OAuth authorization provider that we can "connect" to.
- You define the scopes, consent screen, and token logic
- You enable AI agents to "use" your APIs with proper scoping and authorization

#### Inbound App Example: 10xCRM

Use [10xCRM](https://10x-crm.app) as a model to:

- Set up OAuth endpoints
- Handle access/refresh tokens
- Validate and enforce scopes
- Manage user consent and authorization flows

## 🧪 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Descope account

### 1. Clone and Install

```bash
git clone https://github.com/descope-sample-apps/connected-agent.git
cd connected-agent
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
```

Update `.env.local`:

```env
NEXT_PUBLIC_DESCOPE_PROJECT_ID=your-project-id
DESCOPE_MANAGEMENT_KEY=your-key
DESCOPE_BASE_URL=https://api.descope.com

OPENAI_API_KEY=your-openai-api-key
NEXT_PUBLIC_SEGEMENT_WRITE_KEY=your-segment-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=your-database-url
```

### 3. Set Up the Database

```bash
npm run migrate
```

### 4. Start the App

```bash
npm run dev
```

Once you've set everything up and tested it, you can easily deploy with our one click deploy buttons at the top of this README to either Vercel or Netlify.

## 🛠️ Create Your Own Tool

The great thing about this sample app, is that it's very extensible. As an example, we've also described how you can fork this repo and build your own custom tools, to be used in conjunction with Descope Outbound Apps.

### 1. Define Your Tool

```ts
// lib/ai/tools/my-tool.ts
import { z } from "zod";

export function myTool({ userId, dataStream }) {
  return {
    description: "Your tool description",
    parameters: z.object({
      param1: z.string().describe("Parameter description"),
    }),
    execute: async ({ param1 }) => {
      // Tool logic
      return { success: true, result: "Tool result" };
    },
  };
}
```

### 2. Register the Tool

```ts
// lib/ai/tool-registry.ts
import { myTool } from "./tools/my-tool";

export const toolRegistry = {
  myTool,
  // ... other tools
};
```

### 3. Define Required Scopes

```ts
// lib/oauth-utils.ts
export const DEFAULT_SCOPES = {
  "my-service": ["required.scope1", "required.scope2"],
};
```

## 🏗️ Building Custom Tools

### Example: Custom CRM Tool

```ts
// lib/ai/tools/custom-crm.ts
import { z } from "zod";
import { getOAuthToken } from "@/lib/oauth-utils";

export function customCrmTool({ userId, dataStream }) {
  return {
    description: "Interact with your custom CRM system",
    parameters: z.object({
      action: z.enum(["create", "read", "update", "delete"]),
      entity: z.string().describe("CRM entity like contact or deal"),
      data: z.record(z.any()).optional(),
    }),
    execute: async ({ action, entity, data }) => {
      const token = await getOAuthToken(userId, "custom-crm");

      const response = await fetch(
        `${process.env.CUSTOM_CRM_API_URL}/${entity}`,
        {
          method: action.toUpperCase(),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: data ? JSON.stringify(data) : undefined,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to ${action} ${entity}: ${response.statusText}`
        );
      }

      return {
        success: true,
        result: await response.json(),
      };
    },
  };
}
```

### Register the Tool

```ts
import { customCrmTool } from "./tools/custom-crm";

export const toolRegistry = {
  customCrm: customCrmTool,
  // other tools...
};
```

### Define Scopes

```ts
export const DEFAULT_SCOPES = {
  "custom-crm": ["crm.read", "crm.write"],
};
```

## 🤝 Contributing

We welcome PRs! To contribute:

### 1. Fork and Clone

```bash
git clone https://github.com/yourusername/connected-agent.git
cd connected-agent
```

### 2. Create a Feature Branch

```bash
git checkout -b feature/my-feature
```

### 3. Follow Conventions

- Use TypeScript
- Maintain code style
- Add tests
- Update docs

### 4. Commit and Push

```bash
git commit -m 'feat: my feature'
git push origin feature/my-feature
```

### 5. Open a Pull Request

- Describe your changes
- Link related issues
- Include screenshots for UI changes
- Ensure tests pass

## 📚 License

This project is licensed under the [MIT License](LICENSE).

## 🧰 Support

- 📖 [Documentation](https://docs.descope.com)
- 🐛 [File an Issue](https://github.com/descope-sample-apps/connected-agent/issues)
- 💬 Email: support@descope.com
