# CRM Assistant

<div align="center">
  <img src="/public/crm-assistant-logo.png" alt="CRM Assistant Logo" width="200" />
  <h3>AI-Powered Customer Relationship Management Assistant</h3>
  <p>Streamline your CRM workflow with intelligent automation and seamless integrations</p>
</div>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

## Overview

CRM Assistant is an AI-powered tool that enhances your customer relationship management processes by seamlessly integrating with your existing CRM tools and providing intelligent automation. It combines natural language processing with powerful integrations to help sales professionals manage customer relationships, schedule meetings, create documentation, and more—all from a single, intuitive interface.

<div align="center">
  <img src="/public/crm-assistant-screenshot.png" alt="CRM Assistant Screenshot" width="800" />
</div>

## Features

### 🤖 Intelligent Chat Interface

- Natural language interaction with AI-powered responses
- Context-aware suggestions and recommendations
- Quick action shortcuts for common CRM tasks

### 🔄 Seamless Integrations

- CRM data access and management (customer information, deal history)
- Calendar integration for meeting scheduling
- Video conferencing with Zoom meeting creation
- Document generation with Google Docs

### 🔒 OAuth Provider Management

- Connect and manage third-party service integrations
- Transparent permission control
- Secure authentication flows

### 📊 Comprehensive Dashboard

- Profile management with personal information
- Connected services overview
- Application preferences

### 📝 Chat History Management

- Save important conversations
- Organize and star priority discussions
- Search through past interactions

### 🔗 Sharing Capabilities

- Generate shareable links to conversations
- Control access permissions
- Collaborate with team members

### 🔍 Transparency Features

- Visual explanations of API interactions
- Clear documentation of data flows
- Detailed process breakdowns

## Tech Stack

- **Frontend**: Next.js, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **AI**: OpenAI GPT-4o, AI SDK
- **Authentication**: OAuth 2.0
- **Integrations**: Google Calendar, Zoom, CRM systems

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Vercel account (for deployment)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/crm-assistant.git
   cd crm-assistant

   ```

2. Install dependencies:

```shellscript
npm install
# or
yarn install
```

3. Set up environment variables:

```shellscript
cp .env.example .env.local
```

Then edit `.env.local` with your API keys and configuration.

4. Run the development server:

```shellscript
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Authentication

CRM Assistant uses OAuth for authentication. Users can sign in with:

- Email/password
- Google
- Microsoft
- Other OAuth providers

### Quick Actions

The sidebar provides quick access to common tasks:

- CRM Lookup: Get customer information and deal history
- Schedule Meeting: Create calendar events with contacts
- Create Zoom Meeting: Set up video conferences
- Summarize Deal: Generate deal summaries and save to Google Docs

### Chat Interface

The main chat interface allows natural language interaction:

1. Type your request in the input field
2. The AI will process your request and respond accordingly
3. For complex tasks, the AI may use integrations to fetch data or perform actions
4. Explanations are provided for API interactions

### Managing Connections

In the Profile section, you can:

1. Connect third-party services via OAuth
2. Manage permissions for connected services
3. Refresh connections when needed
4. Disconnect services you no longer want to use

### Chat History

Access your chat history in the Profile section:

1. View past conversations
2. Star important chats
3. Share conversations with colleagues
4. Delete unwanted history

## Configuration

### Environment Variables

The following environment variables are required:

```plaintext
# Descope
NEXT_PUBLIC_DESCOPE_PROJECT_ID=your-descope-project-id
DESCOPE_MANAGEMENT_KEY=your-descope-management-key

# OpenAI
OPENAI_API_KEY=your-openai-api-key
```

### Customization

You can customize the appearance and behavior of CRM Assistant by modifying:

- `tailwind.config.ts` for theme customization
- `components/ui` for UI component styling
- `app/api` for backend API behavior

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Calendar Tools

The CRM Assistant includes powerful calendar integration tools:

### Google Calendar Integration

- **Create Calendar Events**: Schedule meetings and events directly from the assistant
- **List Calendar Events**: View your upcoming calendar events
- **Add Attendees**: Automatically add attendees to your calendar events
- **CRM Contact Integration**: Look up contact emails from your CRM when scheduling meetings

## Usage Examples

### Scheduling a Meeting

```
Schedule a meeting with John Smith tomorrow at 2pm for 1 hour
```

### Viewing Upcoming Events

```
Show me my upcoming calendar events for this week
```

### Creating a Meeting with Multiple Attendees

```
Schedule a team meeting with Sarah, Michael, and David next Monday at 10am for 2 hours
```

## Development

### Tools Structure

The calendar tools are built using a clean, modular architecture:

- `lib/tools/calendar.ts`: Tool for creating calendar events
- `lib/tools/calendar-list.ts`: Tool for listing calendar events

Each tool follows a consistent pattern:

- Clear interface definitions
- Proper validation
- Error handling with user-friendly messages
- OAuth token management
- Google Calendar API integration

### Adding New Calendar Features

To add new calendar features:

1. Create a new tool class in the `lib/tools` directory
2. Extend the base `Tool` class
3. Implement the required methods: `validate` and `execute`
4. Register the tool with the `toolRegistry`
5. Add the tool to the chat route in `app/api/chat/route.ts`
