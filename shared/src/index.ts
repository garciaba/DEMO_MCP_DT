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
  detail?: string;
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

export type AuthProvider = 'github' | 'anthropic';

export interface AuthStatus {
  authenticated: boolean;
  provider?: AuthProvider;
  user?: GitHubUser;
  anthropicUser?: AnthropicUser;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface AnthropicUser {
  name: string;
  email?: string;
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
  // ─── Incident & War Room ────────────────────────────────────
  {
    id: 'inc-active-problems',
    label: 'Active Problems Overview',
    category: 'Incident & War Room',
    text: 'List all currently active problems with their severity, impact level, affected entities, and duration. Rank by business impact.',
    icon: '🔴',
  },
  {
    id: 'inc-triage',
    label: 'Incident Triage',
    category: 'Incident & War Room',
    text: 'Perform a full incident triage: list active problems from the last 60 minutes, identify the most critical one, find the root cause entity, pull error logs and failing traces for that entity, and suggest remediation steps.',
    icon: '🚨',
  },
  {
    id: 'inc-blast-radius',
    label: 'Blast Radius Analysis',
    category: 'Incident & War Room',
    text: 'For the most critical active problem, map the full blast radius: all affected services (upstream and downstream), impacted hosts, affected user sessions, and estimated user impact percentage.',
    icon: '💥',
  },
  {
    id: 'inc-deploy-correlation',
    label: 'Deployment Correlation',
    category: 'Incident & War Room',
    text: 'Correlate all deployments from the last 24 hours with active problems and error rate spikes. For each deployment, show the deployed service, timestamp, and whether error rates or response times changed after deployment.',
    icon: '🚀',
  },
  {
    id: 'inc-error-spike',
    label: 'Error Spike Investigation',
    category: 'Incident & War Room',
    text: 'Detect all services with error rate spikes in the last hour compared to the previous 24h baseline. For the top 3, show the error types, affected endpoints, sample trace IDs, and correlated log patterns.',
    icon: '📈',
  },
  {
    id: 'inc-change-timeline',
    label: 'Recent Change Timeline',
    category: 'Incident & War Room',
    text: 'Build a chronological timeline of the last 2 hours showing: deployment events, configuration changes, detected anomalies, and new problems. Highlight any causal correlations.',
    icon: '🕐',
  },
  {
    id: 'inc-problem-trending',
    label: 'Problem Trending (7d)',
    category: 'Incident & War Room',
    text: 'Analyze problem frequency and categories over the last 7 days. Identify recurring problem patterns, most affected services, and whether the overall problem count is trending up or down. Flag any problems that keep reopening.',
    icon: '📊',
  },

  // ─── Service Performance ────────────────────────────────────
  {
    id: 'svc-red-overview',
    label: 'Service RED Overview',
    category: 'Service Performance',
    text: 'Show the top 10 services ranked by response time over the last 24 hours. For each, include: average and P95 response time, request throughput (req/s), and error rate percentage. Flag any service with error rate above 1% or P95 above 2 seconds.',
    icon: '⚡',
  },
  {
    id: 'svc-slo-health',
    label: 'SLO Health Check',
    category: 'Service Performance',
    text: 'Retrieve the status of all configured SLOs. For each, show the current SLI value, target, remaining error budget percentage, and burn rate. Flag any SLOs at risk of breaching within the next 24 hours.',
    icon: '🎯',
  },
  {
    id: 'svc-latency-outliers',
    label: 'Latency Outliers (P99)',
    category: 'Service Performance',
    text: 'Find services where P99 latency exceeds 2 seconds over the last 24 hours. Compare P99 vs P50 to identify tail latency issues. For the worst 5, break down response time by span type (database, HTTP, internal).',
    icon: '🐌',
  },
  {
    id: 'svc-error-rate',
    label: 'Error Rate Ranking',
    category: 'Service Performance',
    text: 'Rank all services by error rate over the last 24 hours. For services above 1% error rate, show the top 3 error types (exception classes), most affected endpoints, and error count trend (increasing/stable/decreasing).',
    icon: '❌',
  },
  {
    id: 'svc-dependency-map',
    label: 'Service Dependency Map',
    category: 'Service Performance',
    text: 'Map the service dependency topology: for each service, list its upstream callers and downstream dependencies. Include the average latency and error rate at each edge. Highlight any unhealthy dependency with error rate >1% or latency >1s.',
    icon: '🔗',
  },
  {
    id: 'svc-throughput-analysis',
    label: 'Throughput Analysis',
    category: 'Service Performance',
    text: 'Analyze request throughput trends for the top 10 busiest services over the last 24 hours. Identify peak traffic windows, show requests per second at peak vs average, and flag any services showing unusual traffic patterns.',
    icon: '📶',
  },

  // ─── Infrastructure ─────────────────────────────────────────
  {
    id: 'infra-host-health',
    label: 'Host Health Overview',
    category: 'Infrastructure',
    text: 'Provide a health overview of all monitored hosts. Include CPU utilization, memory usage, disk utilization, and network I/O. Flag any host exceeding 80% on CPU, memory, or disk. Group results by OS type and cloud provider.',
    icon: '🖥️',
  },
  {
    id: 'infra-cpu-memory',
    label: 'CPU & Memory Hot Spots',
    category: 'Infrastructure',
    text: 'Find the top 10 hosts by CPU usage and top 10 by memory usage over the last 4 hours. For each, show the top 3 processes consuming the most resources with their PIDs and process group names.',
    icon: '🔥',
  },
  {
    id: 'infra-disk-critical',
    label: 'Disk Space Critical',
    category: 'Infrastructure',
    text: 'List all hosts with disk utilization above 80% on any volume. Show the mount point, total size, used space, and growth rate over the last 7 days. Estimate days until full for volumes growing consistently.',
    icon: '💾',
  },
  {
    id: 'infra-k8s-pod-issues',
    label: 'Kubernetes Pod Issues',
    category: 'Infrastructure',
    text: 'Find all Kubernetes pods in problematic states: CrashLoopBackOff, OOMKilled, ImagePullBackOff, Pending, or Error. For each, show the namespace, workload, node, restart count, last exit code, and relevant log entries.',
    icon: '🐳',
  },
  {
    id: 'infra-k8s-node-pressure',
    label: 'K8s Node Pressure',
    category: 'Infrastructure',
    text: 'List all Kubernetes nodes with any pressure condition (MemoryPressure, DiskPressure, PIDPressure) or NotReady/Unschedulable status. Show CPU and memory utilization, pod count vs allocatable, and affected workloads.',
    icon: '⚠️',
  },
  {
    id: 'infra-container-limits',
    label: 'Container Resource Audit',
    category: 'Infrastructure',
    text: 'Audit Kubernetes containers: find those without CPU or memory limits set, and those consistently using >90% of their limits (throttled). Show namespace, workload, container name, current usage vs limits.',
    icon: '📦',
  },
  {
    id: 'infra-capacity',
    label: 'Capacity Planning',
    category: 'Infrastructure',
    text: 'Analyze capacity headroom across hosts and Kubernetes nodes over the last 7 days. Flag any with less than 20% headroom on CPU or memory at peak. Recommend right-sizing adjustments based on actual P95 utilization.',
    icon: '📐',
  },

  // ─── Frontend & RUM ─────────────────────────────────────────
  {
    id: 'rum-webvitals',
    label: 'Core Web Vitals Report',
    category: 'Frontend & RUM',
    text: 'Report Core Web Vitals trends over the last 24 hours for all web applications: LCP, INP, CLS, and TTFB. Show the percentage of page loads meeting "Good" thresholds. Break down by application and highlight any metrics in "Poor" range.',
    icon: '🌐',
  },
  {
    id: 'rum-sessions',
    label: 'User Session Analysis',
    category: 'Frontend & RUM',
    text: 'Analyze user sessions over the last 24 hours: total session count, unique users, average session duration, bounce rate, and geographic distribution (top 5 countries). Compare with the previous 24h period to show trends.',
    icon: '👥',
  },
  {
    id: 'rum-mobile-crashes',
    label: 'Mobile App Crashes',
    category: 'Frontend & RUM',
    text: 'List the top mobile app crash groups over the last 7 days, ranked by occurrence count. For each, show the crash signature, affected app versions, OS breakdown, and whether the crash is new or recurring.',
    icon: '📱',
  },
  {
    id: 'rum-errors',
    label: 'Frontend Error Tracking',
    category: 'Frontend & RUM',
    text: 'List the top 10 JavaScript errors by occurrence count over the last 24 hours. For each, show the error message, affected pages, browser breakdown, and estimated user impact (number of affected sessions).',
    icon: '🐛',
  },
  {
    id: 'rum-slow-pages',
    label: 'Slowest Pages (P95)',
    category: 'Frontend & RUM',
    text: 'Find the 10 pages with the highest P95 load time over the last 24 hours. For each, show the P50 and P95 load times, number of page views, and break down the load time by resource type (document, scripts, images, XHR).',
    icon: '🐢',
  },

  // ─── Logs & Traces ──────────────────────────────────────────
  {
    id: 'log-recent-errors',
    label: 'Recent Error Logs',
    category: 'Logs & Traces',
    text: 'Fetch ERROR and FATAL log entries from the last hour. Group them by pattern (similar message structure) and show the count for each pattern, the most common source process, and a sample log line.',
    icon: '📋',
  },
  {
    id: 'log-pattern-analysis',
    label: 'Log Pattern Analysis (24h)',
    category: 'Logs & Traces',
    text: 'Identify the top 10 recurring log patterns across all log sources over the last 24 hours, ranked by frequency. For each, show the pattern template, count, severity distribution, and whether it is increasing or decreasing.',
    icon: '🔎',
  },
  {
    id: 'trace-slow',
    label: 'Slow Transaction Traces',
    category: 'Logs & Traces',
    text: 'Find the 10 slowest traces (by total duration) from the last hour. For each, show the entry service and endpoint, total duration, span count, and break down time spent in each span type (HTTP, database, messaging, internal).',
    icon: '🔬',
  },
  {
    id: 'trace-failures',
    label: 'Failed Request Analysis',
    category: 'Logs & Traces',
    text: 'Analyze failed requests from the last hour. Group by service and endpoint, show the failure count, top error types or HTTP status codes, and provide sample trace IDs for investigation.',
    icon: '💔',
  },
  {
    id: 'trace-db-hotspots',
    label: 'Database Span Hotspots',
    category: 'Logs & Traces',
    text: 'Find the slowest database operations across all services over the last 4 hours, ranked by P95 duration. For each, show the database type, statement (truncated), calling service, invocation count, and P50 vs P95 duration.',
    icon: '🗄️',
  },
  {
    id: 'trace-log-correlation',
    label: 'Trace-Log Correlation',
    category: 'Logs & Traces',
    text: 'For the 5 slowest traces from the last hour, fetch the correlated log entries along the full request path. Present as a timeline: trace spans interleaved with log messages, highlighting errors and warnings.',
    icon: '🔀',
  },

  // ─── Cloud & AWS ────────────────────────────────────────────
  {
    id: 'aws-inventory',
    label: 'AWS Resource Inventory',
    category: 'Cloud & AWS',
    text: 'List all monitored AWS resources grouped by type (EC2, RDS, Lambda, S3, etc.) and region. Show the total count per type, per region, and per AWS account. Highlight any resources without Dynatrace monitoring.',
    icon: '☁️',
  },
  {
    id: 'aws-lambda',
    label: 'Lambda Performance',
    category: 'Cloud & AWS',
    text: 'Analyze AWS Lambda functions over the last 24 hours: rank by error rate. For the top 10, show invocation count, average duration, cold start percentage, P95 duration, and memory utilization vs allocation.',
    icon: '⚡',
  },
  {
    id: 'aws-security-groups',
    label: 'Security Group Audit',
    category: 'Cloud & AWS',
    text: 'Audit AWS security groups: find groups with overly permissive inbound rules (0.0.0.0/0 or ::/0) on sensitive ports (22, 3389, 3306, 5432). Also list unattached security groups. Show VPC, group name, and rule details.',
    icon: '🛡️',
  },
  {
    id: 'aws-cost',
    label: 'Cost Optimization',
    category: 'Cloud & AWS',
    text: 'Identify potential cost savings in AWS: unattached EBS volumes, low-utilization EC2 instances (<10% CPU average over 7 days), idle RDS instances (<5 connections), and unused Elastic IPs. Estimate monthly savings.',
    icon: '💰',
  },
  {
    id: 'aws-rds',
    label: 'RDS Database Health',
    category: 'Cloud & AWS',
    text: 'Check the health of all RDS instances: CPU utilization, active connections, replica lag (if applicable), free storage space, and read/write IOPS. Flag any instance with CPU >70%, storage <20% free, or replica lag >10s.',
    icon: '🐘',
  },

  // ─── Management (dtctl) ─────────────────────────────────────
  {
    id: 'dtctl-context',
    label: 'Check dtctl Context',
    category: 'Management (dtctl)',
    text: 'Check the current dtctl context: run dtctl config current-context, dtctl config describe-context, and dtctl auth whoami. Summarize the environment URL, safety level, and authenticated user.',
    icon: '🔧',
  },
  {
    id: 'dtctl-workflows',
    label: 'List Workflows',
    category: 'Management (dtctl)',
    text: 'Use dtctl to list all workflows in the current Dynatrace environment. Show them in a table format with name, state, and last execution time.',
    icon: '⚙️',
  },
  {
    id: 'dtctl-dashboards',
    label: 'List Dashboards',
    category: 'Management (dtctl)',
    text: 'Use dtctl to list all dashboards in the current Dynatrace environment. Show name, owner, and last modified date.',
    icon: '📊',
  },
  {
    id: 'dtctl-notebooks',
    label: 'List Notebooks',
    category: 'Management (dtctl)',
    text: 'Use dtctl to list all notebooks in the current Dynatrace environment. Show name, owner, and privacy status.',
    icon: '📓',
  },
  {
    id: 'dtctl-doctor',
    label: 'Health Check (doctor)',
    category: 'Management (dtctl)',
    text: 'Run dtctl doctor to verify the configuration, context, token, connectivity, and authentication status. Summarize the results and flag any issues.',
    icon: '🩺',
  },
  {
    id: 'dtctl-query',
    label: 'Run DQL Query',
    category: 'Management (dtctl)',
    text: 'Run a DQL query via dtctl: fetch logs | limit 10. Show the results in a formatted table.',
    icon: '🔍',
  },

  // ─── Context Analysis ───────────────────────────────────────
  {
    id: 'ctx-analyze',
    label: 'Analyze Uploaded Files',
    category: 'Context Analysis',
    text: 'Analyze the uploaded context files and provide a summary of key findings, patterns, and potential issues. Prioritize actionable insights.',
    icon: '🔍',
  },
  {
    id: 'ctx-explain',
    label: 'Explain Configuration',
    category: 'Context Analysis',
    text: 'Explain the uploaded configuration in detail. What does each section do? Are there any potential misconfigurations or security concerns?',
    icon: '📖',
  },
];
