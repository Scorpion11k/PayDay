# PayDay AI - Smart Debt Collection Platform

A modern React-based client application for PayDay AI, an intelligent debt collection platform.

## Features

- **AI Command Center**: Central hub for controlling collection operations
- **Smart Navigation**: 9 main sections for comprehensive debt management
  - Home
  - Customers
  - Activities
  - Dashboards
  - Flows
  - Contracts
  - Chat History
  - Customer Insight
  - Integrations
- **AI Chat Interface**: Bottom-center prompt for natural language commands
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **React 19** with TypeScript
- **Vite** for fast development and building
- **Material-UI (MUI) v7** for components and styling
- **React Router v7** for navigation

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173` (or next available port).

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/
│   ├── Chat/
│   │   └── ChatPanel.tsx      # AI chat interface
│   └── SidebarNav.tsx         # Left navigation sidebar
├── layout/
│   └── AppShell.tsx           # Main layout wrapper
├── pages/
│   ├── HomePage.tsx           # Welcome page with quick actions
│   ├── CustomersPage.tsx      # Customer management
│   ├── ActivitiesPage.tsx     # Activity tracking
│   ├── DashboardsPage.tsx     # Analytics dashboards
│   ├── FlowsPage.tsx          # Workflow automation
│   ├── ContractsPage.tsx      # Contract management
│   ├── ChatHistoryPage.tsx    # AI conversation history
│   ├── CustomerInsightPage.tsx # Customer analytics
│   └── IntegrationsPage.tsx   # Third-party integrations
├── theme/
│   └── theme.ts               # MUI theme configuration
├── App.tsx                    # Main app with routes
├── main.tsx                   # Entry point
└── index.css                  # Global styles
```

## License

Private - All rights reserved
