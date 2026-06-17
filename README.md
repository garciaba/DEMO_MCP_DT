# Dynatrace Observability Assistant

An AI-powered observability assistant that combines **GitHub Copilot LLMs** (or **Anthropic models**), **Dynatrace MCP** (Model Context Protocol), **dtctl CLI**, and **Dynatrace domain skills** into a single web application for intelligent, evidence-driven investigation and management of Dynatrace environments.

## What It Does

The assistant acts as an **agentic AI copilot for Dynatrace**. It can:

- **Query live observability data** — Fetch logs, metrics, traces, problems, and entity topology via the Dynatrace MCP server in real time.
- **Execute DQL queries** — Generate and run Dynatrace Query Language queries with built-in syntax guidance from domain skills.
- **Manage Dynatrace configuration** — Create, modify, and inspect workflows, dashboards, notebooks, SLOs, and settings via dtctl.
- **Analyze uploaded context** — Ingest configuration files, logs, or data exports and reason over them alongside live telemetry.
- **Triage incidents** — Follow structured workflows (problem → impact → traces → root cause → remediation) with tool calls at each step.
- **Provide domain expertise** — Load on-demand skill packs covering 17 Dynatrace domains (DQL, services, frontends, traces, hosts, Kubernetes, AWS, Azure, GCP, logs, problems, predictive analytics, alerting, dashboards, notebooks, JS runtime, and entity migration), each with detailed reference files.

The LLM operates in an **agentic tool-calling loop** (up to 10 rounds per message), autonomously deciding which tools to invoke — MCP for live data, dtctl for configuration, and skills for domain knowledge — then synthesizing the results into a coherent response streamed in real time.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite + Tailwind)           │
│  ┌────────────┐  ┌────────────────┐  ┌───────────────────────────┐ │
│  │ Left Panel  │  │  Chat Panel    │  │  Right Panel              │ │
│  │ • Prompts   │  │  • Messages    │  │  • dtctl status & login   │ │
│  │ • Context   │  │  • SSE stream  │  │  • Telemetry config       │ │
│  │   files     │  │  • Tool calls  │  │  • MCP connection         │ │
│  │ • Model     │  │  • Markdown    │  │  • Model selection        │ │
│  │   selector  │  │  • MCP log     │  │                           │ │
│  └────────────┘  └────────────────┘  └───────────────────────────┘ │
│                      Zustand (auth + chat stores)                   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP + SSE
┌──────────────────────────┴──────────────────────────────────────────┐
│                       Backend (Fastify + TypeScript)                │
│                                                                     │
│  Routes                        Services                             │
│  ├─ /api/auth/*    GitHub OAuth ├─ Session store (in-memory)        │
│  ├─ /api/chat/stream  SSE chat  ├─ MCP client (JSON-RPC 2.0)        │
│  ├─ /api/context/* file upload  ├─ MCP context builder (96k budget) │
│  ├─ /api/dynatrace/* MCP proxy  ├─ dtctl service (binary mgmt)      │
│  ├─ /api/dtctl/*   CLI mgmt    ├─ Skills service (13 skills)        │
│  ├─ /api/models    model list   └─ System instructions engine       │
│  └─ /api/telemetry OTel config                                      │ 
│                                                                     │
│  ┌────────────────── Agentic Tool Loop (max 10 rounds) ──────────┐  │
│  │  LLM ←→ load_dynatrace_skill ←→ dtctl_run ←→ MCP tools        │   │
│  │       ←→ load_dynatrace_skill_reference ←→ dtctl_context_info │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  OpenTelemetry (GenAI semconv → OTLP → Dynatrace)                   │
└─────────────────────────────────────────────────────────────────────┘
         │                          │                      │
         ▼                          ▼                      ▼
  GitHub Copilot API       Dynatrace MCP Server       dtctl binary
  or Anthropic API
  (LLM inference)          (live observability)       (config mgmt)
```

### Dual-Plane Design

| Plane | Channel | Purpose | Examples |
|-------|---------|---------|----------|
| **Runtime** | Dynatrace MCP | Live observability queries and analytics | Fetch logs, list problems, query metrics, trace spans |
| **Management** | dtctl CLI | Configuration changes and inventory | Create dashboards, edit workflows, apply settings, list notebooks |

The LLM's system instructions encode a **routing decision map** so it automatically picks the right plane for each task.

---

## Features

### Core Chat
- **Streaming responses** — Real-time SSE from GitHub Copilot API or Anthropic Messages API with delta, tool-call, and MCP-traffic events
- **Model selection** — GPT-4o, GPT-4o Mini, Claude Sonnet 4, o3-mini (dynamic list from Copilot API), or Anthropic models (Claude Opus 4, Sonnet 4, Haiku, etc.)
- **Agentic tool calling** — Multi-round loop (up to 10 iterations) where the LLM autonomously invokes tools and reasons over results
- **Markdown rendering** — Full GFM support with syntax-highlighted code blocks

### Dynatrace MCP Integration
- **Connect to any Dynatrace MCP server** — URL + bearer token configuration in the UI
- **Automatic tool discovery** — MCP tools are listed and registered as LLM function calls
- **Live MCP activity log** — Expandable per-message log showing sent/received tool traffic

### dtctl CLI Integration
- **Auto-install** — Downloads dtctl v0.18.0 binary (platform/arch detected) with one click
- **OAuth login** — Browser-based SSO flow to authenticate with a Dynatrace environment
- **Safe command execution** — Write operations require explicit confirmation; injection prevention (no semicolons, pipes, backticks)
- **Context awareness** — Pre-flight checks (`dtctl_context_info`) before any state-changing command

### Dynatrace Domain Skills
- **17 domain skills** loaded on-demand by the LLM via tool calls:

  | Skill | Domain |
  |-------|--------|
  | `dt-dql-essentials` | DQL syntax, functions, pitfalls, optimization |
  | `dt-obs-services` | Service RED metrics, runtime-specific telemetry (.NET, Java, Node.js, Python, PHP, Go) |
  | `dt-obs-frontends` | RUM, Web Vitals, user sessions, mobile, frontend errors |
  | `dt-obs-tracing` | Distributed traces, spans, failure detection, performance |
  | `dt-obs-hosts` | Host/process metrics — CPU, memory, disk, containers |
  | `dt-obs-kubernetes` | Clusters, pods, nodes, workloads, storage, networking |
  | `dt-obs-aws` | EC2, RDS, Lambda, ECS/EKS, VPC, cost optimization |
  | `dt-obs-azure` | VMs, SQL Database, Storage, AKS, App Service, Functions, VNet |
  | `dt-obs-gcp` | Compute Engine, GKE, Cloud Run, Pub/Sub, VPC, IAM |
  | `dt-obs-logs` | Log queries, filtering, pattern analysis, correlation |
  | `dt-obs-problems` | Problems, RCA, impact analysis, problem correlation |
  | `dt-obs-predictive-analytics` | Forecasting, capacity planning, anomaly/trend detection |
  | `dt-alerting` | Anomaly detectors, Davis events, workflow notifications |
  | `dt-app-dashboards` | Dashboard creation, tiles, variables, visualizations |
  | `dt-app-notebooks` | Notebook creation, sections, analytics workflows |
  | `dt-js-runtime` | Dynatrace server-side JS runtime, @dynatrace-sdk/* catalog |
  | `dt-migration` | Classic entity → Smartscape migration patterns |

- **250+ reference files** for deep-dive sub-topics (e.g., individual DQL function categories, runtime-specific metrics, SDK API docs, entity migration patterns), loadable via `load_dynatrace_skill_reference`

### Context Management
- **File uploads** — JSON, YAML, TXT, CSV, MD, LOG, XML, Python, JS/TS, Dockerfile, .env (up to 20 files, 12 MB total, 5 MB per file)
- **Smart context budget** — 96k-token system context with per-file truncation (60k tokens) and budget warnings at 80%
- **Custom system prompts** — Override or augment the default system instructions

### Authentication & Security
- **Dual auth providers** — GitHub OAuth Device Flow or Anthropic API key login
- **8-hour sessions** — In-memory session store with httpOnly signed cookies
- **Backend proxy** — Dynatrace API tokens stay server-side (never exposed to the browser)
- **Rate limiting** — 100 requests/minute per client
- **Security headers** — Helmet (CSP, HSTS, etc.) + CORS per environment
- **File validation** — Extension whitelist, size limits, binary rejection

### Observability (OpenTelemetry)
- **GenAI semantic conventions** — Every LLM call and tool execution emits OTel spans with input/output tokens, model, finish reason, tool arguments and results
- **OTLP export to Dynatrace** — Traces and metrics shipped to any OTLP-compatible backend
- **Runtime reconfiguration** — Change the OTLP endpoint and token from the UI without restarting the server
- **Connection testing** — Validate OTLP connectivity before committing config changes

### Predefined Prompts
One-click prompts organized by category:

| Category | Prompts |
|----------|---------|
| **Dynatrace** | List Active Problems, Host Health Overview, Service Performance, Recent Error Logs, SLO Status, Recent Deployments |
| **Context** | Analyze Uploaded Context, Explain Configuration |
| **dtctl** | Check Context, List Workflows, List Dashboards, Health Check (doctor), DQL Query, List Notebooks |

---

## Prerequisites

- **Node.js 20+**
- **A GitHub OAuth App** — [Create one here](https://github.com/settings/applications/new) *(for GitHub provider)*
- **A GitHub Copilot license** on the authenticating GitHub account *(for GitHub provider)*
- **An Anthropic API key** *(alternative — for Anthropic provider)*
- **A Dynatrace environment** (optional) — For MCP and dtctl integration

---

## Quick Start

### 1. Clone and configure

```bash
git clone <repo-url>
cd DEMO_MCP_DT
cp .env.example .env
```

Edit `.env` with your credentials:

```dotenv
# Required — GitHub OAuth App
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Optional — OpenTelemetry export to Dynatrace
OTEL_EXPORTER_OTLP_ENDPOINT=https://<env-id>.live.dynatrace.com/api/v2/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Api-Token <your-token>
```

### 2. Install dependencies

```bash
npm run install:all
```

### 3. Start development

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend (Vite) | http://localhost:5173 |
| Backend (Fastify) | http://localhost:3001 |

### 4. Authenticate

**Option A — GitHub (Copilot models):**
1. Open the frontend in your browser.
2. Click **Sign in with GitHub** — a device code is displayed.
3. Open the GitHub verification URL, enter the code, and authorize.
4. The app polls for the token and starts your session.

**Option B — Anthropic (Claude models):**
1. Switch to the **Anthropic** tab on the login screen.
2. Enter your Anthropic API key.
3. Click **Sign in with Anthropic** — the key is validated and your session starts.

### 5. Connect to Dynatrace (optional)

**Via MCP Server:**
1. In the right panel, enter your Dynatrace MCP Server URL and bearer token.
2. Click **Connect** — available tools are listed automatically.

**Via dtctl:**
1. In the right panel, click **Install dtctl** (auto-downloads the binary).
2. Click **Login** and enter your Dynatrace environment URL.
3. Complete the browser-based SSO flow.

---

## GitHub OAuth Setup

1. Go to [GitHub Developer Settings → OAuth Apps](https://github.com/settings/applications/new)
2. Create a new OAuth App:
   - **Application name**: Dynatrace Observability Assistant
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:5173`
3. Copy the **Client ID** and **Client Secret** into your `.env` file.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_CLIENT_ID` | — | **Required.** GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | — | **Required.** GitHub OAuth App Client Secret |
| `PORT` | `3001` | Server listen port |
| `NODE_ENV` | `development` | `development` or `production` |
| `LOG_LEVEL` | `info` | Pino log level (`debug`, `info`, `warn`, `error`) |
| `COOKIE_SECRET` | *auto-generated* | Cookie signing secret (random if not set) |
| `ALLOWED_ORIGIN` | — | CORS origin for production (e.g., `https://myapp.example.com`) |
| `OTEL_SERVICE_NAME` | `dynatrace-observability-assistant` | OpenTelemetry service name |
| `OTEL_SERVICE_VERSION` | `1.0.0` | OpenTelemetry service version |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | OTLP endpoint (e.g., `https://<env>.live.dynatrace.com/api/v2/otlp`) |
| `OTEL_EXPORTER_OTLP_HEADERS` | — | OTLP auth headers (e.g., `Authorization=Api-Token dt0c01...`) |

---

## Docker Deployment

The project includes a multi-stage Dockerfile for optimized production builds.

### Build and run

```bash
docker compose up --build
```

The app is available at **http://localhost:3000**.

### What the Docker build does

| Stage | Purpose |
|-------|---------|
| **Builder** | Installs all dependencies, builds the Vite client, compiles the TypeScript server |
| **Production** | Copies only production dependencies + built artifacts into a slim `node:20-alpine` image (~150 MB) |

### docker-compose.yml

```yaml
services:
  mcp-chat:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      - COOKIE_SECRET=${COOKIE_SECRET}
    restart: unless-stopped
```

### Production considerations

- **Session store** — Replace the in-memory session store with Redis for multi-instance deployments.
- **CORS** — Set `ALLOWED_ORIGIN` to your production domain.
- **Secrets** — Use a secrets manager; do not commit `.env` files.
- **Telemetry** — Set `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` for trace/metric export.

---

## Project Structure

```
├── client/                          # React frontend (Vite + Tailwind)
│   └── src/
│       ├── components/
│       │   ├── ChatLayout.tsx       # 3-panel layout shell
│       │   ├── ChatPanel.tsx        # Chat messages, SSE consumer, markdown
│       │   ├── LeftPanel.tsx        # Prompts, file uploads, model selector
│       │   ├── RightPanel.tsx       # dtctl, telemetry, MCP config
│       │   └── LoginScreen.tsx      # GitHub + Anthropic login UI
│       ├── stores/
│       │   ├── auth.ts             # Authentication state (Zustand)
│       │   └── chat.ts            # Chat, context, MCP, dtctl state (Zustand)
│       └── main.tsx
├── server/                          # Fastify backend (TypeScript)
│   └── src/
│       ├── config/
│       │   └── env.ts              # Environment variable parsing
│       ├── instructions/
│       │   ├── system-instructions.md   # LLM system prompt (routing, safety, workflows)
│       │   └── skills/             # 17 domain skills + 250+ reference files
│       │       ├── dt-dql-essentials.md
│       │       ├── dt-dql-essentials/   # 31 DQL reference files
│       │       ├── dt-obs-services.md
│       │       ├── dt-obs-services/     # 7 runtime-specific refs
│       │       ├── dt-js-runtime/       # 122 SDK reference files
│       │       ├── ...                  # (one .md + directory per skill)
│       │       └── dt-migration/        # 17 migration reference files
│       ├── routes/
│       │   ├── auth.ts             # GitHub OAuth + Anthropic API key auth
│       │   ├── chat.ts             # SSE streaming + agentic tool loop (GitHub & Anthropic)
│       │   ├── context.ts          # File upload/download/budget
│       │   ├── dtctl.ts            # dtctl install/login/exec
│       │   ├── dynatrace.ts        # MCP server connect/tools
│       │   ├── models.ts           # LLM model listing
│       │   └── telemetry.ts        # OTel config management
│       ├── services/
│       │   ├── dtctl.ts            # dtctl binary management + command execution
│       │   ├── dtctl-skill.ts      # System instructions loader
│       │   ├── mcp-client.ts       # MCP JSON-RPC 2.0 client
│       │   ├── mcp-context.ts      # Context aggregation + budget management
│       │   ├── session.ts          # In-memory session store (8h TTL, multi-provider)
│       │   └── skills.ts           # Skill catalog (17 skills), loader, reference loader
│       ├── telemetry.ts            # OpenTelemetry SDK setup + runtime reconfig
│       ├── semconv.ts              # GenAI semantic convention constants
│       └── index.ts                # Entry point
├── shared/                          # Shared TypeScript types
│   └── src/index.ts                # ChatMessage, ContextPayload, MCPConfig, etc.
├── Dockerfile                       # Multi-stage production build
├── docker-compose.yml
└── package.json                     # Root workspace scripts
```

---

## How It Works

### Agentic Chat Flow

```
User sends message
       │
       ▼
  Build system context
  (instructions + skills catalog + files + DT data)
       │
       ▼
  Truncate to 96k-token budget
       │
       ▼
  ┌─── Tool loop (up to 10 rounds) ──────────────────┐
  │                                                    │
  │  Send messages + tools → GitHub Copilot API / Anthropic API        │
  │       │                                            │
  │       ▼                                            │
  │  Stream response (SSE deltas to browser)           │
  │       │                                            │
  │  finish_reason = tool_calls?                       │
  │       │ YES                    │ NO                │
  │       ▼                        ▼                   │
  │  Dispatch each tool call    Done — send 'done' SSE │
  │  ┌─ load_dynatrace_skill                          │
  │  ├─ load_dynatrace_skill_reference                │
  │  ├─ dtctl_run / dtctl_context_info                │
  │  └─ MCP tool (via JSON-RPC)                       │
  │       │                                            │
  │  Add tool results to messages                      │
  │  Continue loop ───────────────────────────────────┘
  │                                                    │
  └────────────────────────────────────────────────────┘
```

### Context Budget

The system context (sent as the first message to the LLM) is assembled from:

1. **System instructions** (~6k tokens) — Routing rules, safety protocols, DQL guidelines, workflows, skill catalog
2. **User system prompt** (optional) — Custom instructions from the context panel
3. **Uploaded files** — Truncated per-file to 60k tokens, total budget 96k tokens
4. **Dynatrace data** — JSON payload from MCP or context API

A warning is emitted via SSE when usage exceeds 80% of the budget.

### Tool Dispatch Order

When the LLM emits tool calls, they are dispatched in this priority:

1. **`load_dynatrace_skill`** — Load a domain skill (returns markdown content)
2. **`load_dynatrace_skill_reference`** — Load a reference file for a skill
3. **`dtctl_run` / `dtctl_context_info`** — Execute dtctl commands or get context info
4. **MCP tools** (fallback) — Forward to the connected Dynatrace MCP server via JSON-RPC

---

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/device-code` | Start GitHub device flow (returns `user_code` + `verification_uri`) |
| POST | `/poll-token` | Poll for access token after user authorization |
| POST | `/anthropic-login` | Login with Anthropic API key (validates against Anthropic API) |
| GET | `/status` | Check current session, user info, and provider |
| POST | `/logout` | Destroy session |

### Chat (`/api/chat`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/stream` | Agentic chat with SSE streaming (main endpoint) |

### Context (`/api/context`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload a context file (multipart, max 5 MB) |
| GET | `/files` | List uploaded files |
| DELETE | `/files/:name` | Remove a specific file |
| DELETE | `/files` | Clear all files |
| GET | `/payload` | Get full context payload |
| GET | `/budget` | Get context usage (bytes, percent, file count) |

### Dynatrace MCP (`/api/dynatrace`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/connect` | Connect to a Dynatrace MCP server |
| POST | `/tools` | List available MCP tools |
| POST | `/disconnect` | Disconnect from MCP server |

### dtctl (`/api/dtctl`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Check dtctl installation, version, auth status |
| POST | `/install` | Auto-download and install dtctl binary |
| POST | `/exec` | Execute a dtctl command |
| POST | `/login` | OAuth login to a Dynatrace environment |
| POST | `/logout` | Logout and delete context |

### Models (`/api/models`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List available GitHub Copilot models |

### Telemetry (`/api/telemetry`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/config` | Get current OTel config |
| POST | `/config` | Update OTel config at runtime |
| POST | `/test` | Test OTLP endpoint connectivity |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Returns `{ status: 'ok', timestamp }` |

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Fastify** over Express | 2–3x faster, built-in schema validation, TypeScript-first |
| **SSE** over WebSocket | Simpler for unidirectional streaming, native browser support |
| **Dual auth** (Device Flow + API key) | GitHub Device Flow for Copilot, Anthropic API key for Claude — no redirect URIs needed |
| **Zustand** state | Minimal boilerplate, no context providers, tiny bundle |
| **Backend proxy** for DT | API tokens stay server-side, prevents browser exposure |
| **In-memory sessions** | Sufficient for single-instance demo; swap to Redis for production |
| **On-demand skills** | Only loaded when the LLM needs them — keeps system context lean |
| **Dual-plane routing** | Separates live observation (MCP) from configuration changes (dtctl) |
| **GenAI OTel semconv** | Full observability of LLM interactions — token usage, tool results, latency |

---

## Security

- **GitHub tokens** and **Anthropic API keys** stored in httpOnly signed cookies (never in localStorage)
- **Dynatrace API tokens** proxied server-side (never sent to the browser)
- **SSRF protection** on the Dynatrace proxy (relative paths only)
- **Command injection prevention** — dtctl commands are parsed and validated against an allowed-verb whitelist; semicolons, pipes, and backticks are blocked
- **Write operation safety** — dtctl write verbs require explicit `confirmWrite` flag; context is verified (`dtctl_context_info`) before execution
- **File upload validation** — Extension whitelist, 5 MB per-file limit, binary content rejection
- **Rate limiting** — 100 requests/minute per client
- **Security headers** — Helmet (CSP, X-Content-Type-Options, HSTS, etc.)
- **CORS** — Restricted to `localhost:5173` in development, configurable via `ALLOWED_ORIGIN` in production

---

## Running Tests

```bash
cd server && npm test
```
