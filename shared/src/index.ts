// ─── Chat Types ───────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  context?: ContextPayload;
  mcpConfig?: MCPConfig;
}

export interface ChatStreamEvent {
  type: 'delta' | 'done' | 'error' | 'tool_call' | 'mcp_message' | 'context_warning';
  content?: string;
  error?: string;
  toolName?: string;
  status?: 'calling' | 'done' | 'error';
  direction?: 'sent' | 'received';
  summary?: string;
  budget?: ContextBudget;
}

// ─── MCP Activity Types ───────────────────────────────────────

export interface MCPActivityItem {
  id: string;
  direction: 'sent' | 'received';
  toolName: string;
  summary: string;
  timestamp: number;
}

// ─── Context Types ────────────────────────────────────────────

export interface ContextFile {
  name: string;
  content: string;
  type: string;
  size: number;
}

export interface DynatraceConfig {
  tenantUrl: string;
  apiToken: string;
}

export interface MCPConfig {
  mcpServerUrl: string;
  bearerToken: string;
}

export interface ContextPayload {
  files: ContextFile[];
  dynatraceData?: Record<string, unknown>;
  systemPrompt?: string;
}

export interface ContextBudget {
  usedBytes: number;
  maxBytes: number;
  usedPercent: number;
  fileCount: number;
  maxFileCount: number;
}

// ─── Auth Types ───────────────────────────────────────────────

export interface AuthStatus {
  authenticated: boolean;
  user?: GitHubUser;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

// ─── Model Types ──────────────────────────────────────────────

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  description?: string;
}

export const AVAILABLE_MODELS: LLMModel[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'copilot', description: 'Most capable model' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'copilot', description: 'Fast and efficient' },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'copilot', description: 'Anthropic Sonnet' },
  { id: 'o3-mini', name: 'o3-mini', provider: 'copilot', description: 'Reasoning model' },
];

// ─── Dynatrace Types ──────────────────────────────────────────

export interface DynatraceAuthStatus {
  connected: boolean;
  mcpServerUrl?: string;
  toolCount?: number;
}

// ─── dtctl Types ──────────────────────────────────────────────

export interface DtctlStatus {
  installed: boolean;
  version?: string;
  currentContext?: string;
  contextDescription?: string;
  whoami?: string;
}

export interface DtctlExecResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  isWriteOperation: boolean;
}

// ─── Predefined Prompts ──────────────────────────────────────

export interface PredefinedPrompt {
  id: string;
  label: string;
  category: string;
  text: string;
  icon?: string;
}

export const PREDEFINED_PROMPTS: PredefinedPrompt[] = [
  {
    id: 'dt-problems',
    label: 'List Active Problems',
    category: 'Dynatrace',
    text: 'Using the Dynatrace API, list all currently active problems with their severity, impact, and affected entities.',
    icon: '🔴',
  },
  {
    id: 'dt-hosts',
    label: 'Host Health Overview',
    category: 'Dynatrace',
    text: 'Query Dynatrace for a health overview of all monitored hosts. Include CPU, memory usage, and disk utilization.',
    icon: '🖥️',
  },
  {
    id: 'dt-services',
    label: 'Service Performance',
    category: 'Dynatrace',
    text: 'Analyze the top 10 services by response time from Dynatrace. Highlight any services with error rates above 1%.',
    icon: '⚡',
  },
  {
    id: 'dt-logs',
    label: 'Recent Error Logs',
    category: 'Dynatrace',
    text: 'Fetch the most recent error log entries from Dynatrace and summarize the most common error patterns.',
    icon: '📋',
  },
  {
    id: 'dt-slo',
    label: 'SLO Status',
    category: 'Dynatrace',
    text: 'Retrieve the current SLO status for all configured service level objectives. Flag any SLOs at risk.',
    icon: '🎯',
  },
  {
    id: 'dt-deployment',
    label: 'Recent Deployments',
    category: 'Dynatrace',
    text: 'Show all deployment events from the last 24 hours detected by Dynatrace, including the impacted services.',
    icon: '🚀',
  },
  {
    id: 'ctx-analyze',
    label: 'Analyze Uploaded Context',
    category: 'Context',
    text: 'Analyze the uploaded context files and provide a summary of key findings, patterns, and potential issues.',
    icon: '🔍',
  },
  {
    id: 'ctx-explain',
    label: 'Explain Configuration',
    category: 'Context',
    text: 'Explain the uploaded configuration in detail. What does each section do? Are there any potential misconfigurations?',
    icon: '📖',
  },
  {
    id: 'dtctl-context',
    label: 'Check dtctl Context',
    category: 'dtctl',
    text: 'Check the current dtctl context: run dtctl config current-context, dtctl config describe-context, and dtctl auth whoami. Summarize the environment URL, safety level, and authenticated user.',
    icon: '🔧',
  },
  {
    id: 'dtctl-workflows',
    label: 'List Workflows',
    category: 'dtctl',
    text: 'Use dtctl to list all workflows in the current Dynatrace environment. Show them in a table format.',
    icon: '⚙️',
  },
  {
    id: 'dtctl-dashboards',
    label: 'List Dashboards',
    category: 'dtctl',
    text: 'Use dtctl to list all dashboards in the current Dynatrace environment.',
    icon: '📊',
  },
  {
    id: 'dtctl-doctor',
    label: 'Health Check (doctor)',
    category: 'dtctl',
    text: 'Run dtctl doctor to verify the configuration, context, token, connectivity, and authentication status.',
    icon: '🩺',
  },
  {
    id: 'dtctl-query',
    label: 'DQL Query via dtctl',
    category: 'dtctl',
    text: 'Run a DQL query via dtctl: fetch logs | limit 10. Show the results.',
    icon: '🔍',
  },
  {
    id: 'dtctl-notebooks',
    label: 'List Notebooks',
    category: 'dtctl',
    text: 'Use dtctl to list all notebooks in the current Dynatrace environment.',
    icon: '📓',
  },
];
