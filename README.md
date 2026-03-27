# MCP Chat Client — Dynatrace Demo

A polished MCP (Model Context Protocol) chat web client for demoing GitHub Copilot Chat with Dynatrace integration.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                  │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Left Panel│  │  Chat Panel  │  │     Right Panel          │  │
│  │ • Prompts │  │  • Messages  │  │  • Model Selection       │  │
│  │ • Context │  │  • Streaming │  │  • Dynatrace Config      │  │
│  │   Files   │  │  • Markdown  │  │                          │  │
│  └──────────┘  └──────────────┘  └──────────────────────────┘  │
│                     Zustand Stores                              │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────┴────────────────────────────────────────┐
│                    Backend (Fastify)                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐   │
│  │Auth Routes│  │Chat Route │  │ DT Routes │  │Context Route│   │
│  │(GitHub)  │  │(SSE stream)│  │(proxy)    │  │(file upload)│   │
│  └──────────┘  └──────────┘  └───────────┘  └──────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              MCP Context Builder                         │   │
│  │  Aggregates: chat history + files + DT data → prompt     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **GitHub Authentication** — OAuth Device Flow (works without redirect URIs)
- **Streaming Chat** — Real-time SSE streaming from GitHub Copilot API
- **Model Selection** — GPT-4o, GPT-4o Mini, Claude Sonnet, o3-mini
- **Dynatrace Integration** — Connect tenant, proxy API calls securely
- **Context Injection** — Upload JSON/YAML/TXT/CSV/MD files as context
- **Predefined Prompts** — One-click Dynatrace analysis prompts
- **MCP Context Aggregation** — Builds structured prompts from all sources

## Prerequisites

- Node.js 20+
- A GitHub OAuth App ([create one here](https://github.com/settings/applications/new))
- A GitHub Copilot license on the authenticating account

## Quick Start

### 1. Setup environment

```bash
cp .env.example .env
# Edit .env with your GitHub OAuth credentials
```

### 2. Install dependencies

```bash
npm run install:all
```

### 3. Start development

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/applications/new)
2. Create a new OAuth App:
   - **Application name**: MCP Chat Demo
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:5173`
3. Copy the Client ID and Client Secret to your `.env` file

## Docker Deployment

```bash
# Build and run
docker compose up --build

# App available at http://localhost:3000
```

## Project Structure

```
├── client/              # React frontend (Vite)
│   └── src/
│       ├── components/  # UI components
│       ├── stores/      # Zustand state stores
│       └── main.tsx     # Entry point
├── server/              # Fastify backend
│   └── src/
│       ├── config/      # Environment config
│       ├── routes/      # API routes
│       ├── services/    # Business logic
│       └── index.ts     # Entry point
├── shared/              # Shared types & constants
│   └── src/index.ts
├── Dockerfile           # Multi-stage production build
└── docker-compose.yml
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Fastify** over Express | 2-3x faster, built-in schema validation, TS-first |
| **SSE** over WebSocket | Simpler for unidirectional streaming, native browser support |
| **Device Flow** auth | Works without redirect URIs, ideal for dev/demo |
| **Zustand** state | Minimal boilerplate, no context providers needed |
| **Backend proxy** for DT | Keeps API tokens server-side, prevents exposure |
| **In-memory sessions** | Sufficient for demo; swap to Redis for production |

## Security

- GitHub tokens stored in httpOnly cookies only
- Dynatrace API tokens never stored on frontend state alone — proxied via backend
- SSRF protection on Dynatrace proxy (relative paths only)
- File upload validation (type + size limits)
- CORS configured per environment

## Running Tests

```bash
cd server && npm test
```
