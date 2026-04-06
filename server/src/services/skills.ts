import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Dynatrace Domain Skills Service ────────────────────────
// Provides on-demand loading of Dynatrace domain skills from
// github.com/Dynatrace/dynatrace-for-ai
// Skills are loaded by the LLM via a tool call when it needs
// domain-specific knowledge for a particular topic.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(__dirname, '..', 'instructions', 'skills');

/** Skill catalog entry — name + short description for the system prompt */
interface SkillEntry {
  name: string;
  description: string;
}

/**
 * Compact catalog of all available Dynatrace domain skills.
 * Only names and descriptions are included in the system prompt (~100 tokens each).
 * Full skill content is loaded on-demand via the load_dynatrace_skill tool.
 */
const SKILL_CATALOG: SkillEntry[] = [
  {
    name: 'dt-dql-essentials',
    description: 'REQUIRED before generating any DQL queries. Provides critical syntax rules, common pitfalls, and patterns.',
  },
  {
    name: 'dt-obs-services',
    description: 'Service metrics, RED metrics (Rate, Errors, Duration), and runtime-specific telemetry for .NET, Java, Node.js, Python, PHP, and Go.',
  },
  {
    name: 'dt-obs-frontends',
    description: 'Real User Monitoring (RUM), Web Vitals, user sessions, mobile crashes, page performance, and frontend errors.',
  },
  {
    name: 'dt-obs-tracing',
    description: 'Distributed traces, spans, service dependencies, performance analysis, and failure detection.',
  },
  {
    name: 'dt-obs-hosts',
    description: 'Host and process metrics including CPU, memory, disk, network, containers, and process-level telemetry.',
  },
  {
    name: 'dt-obs-kubernetes',
    description: 'Kubernetes clusters, pods, nodes, workloads, storage, networking, and resource relationships.',
  },
  {
    name: 'dt-obs-aws',
    description: 'AWS cloud resources: EC2, RDS, Lambda, ECS/EKS, VPC, load balancers, databases, serverless, messaging, and cost optimization.',
  },
  {
    name: 'dt-obs-logs',
    description: 'Log queries, filtering, pattern analysis, and log correlation.',
  },
  {
    name: 'dt-obs-problems',
    description: 'Problem entities, root cause analysis (RCA), impact assessment, and problem correlation.',
  },
  {
    name: 'dt-app-dashboards',
    description: 'Create, modify, query, and analyze Dynatrace dashboards: tiles, layouts, DQL queries, variables, and visualizations.',
  },
  {
    name: 'dt-app-notebooks',
    description: 'Create, modify, query, and analyze Dynatrace notebooks: sections, DQL queries, and analytics workflows.',
  },
  {
    name: 'dt-migration',
    description: 'Migrate classic entity-based DQL and topology navigation to Smartscape equivalents.',
  },
];

/** Valid skill names for quick validation */
const VALID_SKILL_NAMES = new Set(SKILL_CATALOG.map(s => s.name));

/**
 * Reference file catalog per skill.
 * Each key is a skill name, each value is the list of reference file names
 * (without .md extension) available under server/src/instructions/skills/<skill>/.
 * Skills with no references (dt-obs-logs) are omitted.
 */
const SKILL_REFERENCES: Record<string, string[]> = {
  'dt-dql-essentials': [
    'iterative-expressions', 'operators', 'optimization', 'semantic-dictionary',
    'smartscape-topology-navigation', 'summarization', 'useful-expressions',
    'dql--dql-commands', 'dql--dql-data-types', 'dql--dql-functions-aggregation',
    'dql--dql-functions-array', 'dql--dql-functions-bitwise', 'dql--dql-functions-boolean',
    'dql--dql-functions-cast', 'dql--dql-functions-constant', 'dql--dql-functions-conversion',
    'dql--dql-functions-create', 'dql--dql-functions-cryptographic', 'dql--dql-functions-entities',
    'dql--dql-functions-expression-timeseries', 'dql--dql-functions-flow', 'dql--dql-functions-general',
    'dql--dql-functions-get', 'dql--dql-functions-iterative', 'dql--dql-functions-mathematical',
    'dql--dql-functions-network', 'dql--dql-functions-smartscape', 'dql--dql-functions-string',
    'dql--dql-functions-time', 'dql--dql-functions-timeseries', 'dql--dql-parameter-value-types',
  ],
  'dt-obs-services': [
    'dotnet', 'go', 'java', 'nodejs', 'php', 'python', 'service-metrics',
  ],
  'dt-obs-frontends': [
    'AdvancedPerformance', 'CSPViolations', 'error-tracking', 'FrontendBasics', 'FrontendErrors',
    'index', 'LongTasks', 'mobile-monitoring', 'MobileAppStart', 'MobileCrashes',
    'NavigationPatterns', 'PageViewAnalysis', 'performance-analysis', 'RequestPerformance',
    'RequestTimingAnalysis', 'TraceCorrelation', 'user-sessions', 'UserAction', 'UserEngagement',
    'UserInteractions', 'UserSessions', 'UserSessionsProperties', 'VisibilityChanges', 'WebVitals',
  ],
  'dt-obs-tracing': [
    'database-spans', 'entity-lookups', 'failure-detection', 'http-spans', 'logs-correlation',
    'messaging-spans', 'networking-analysis', 'performance-analysis', 'request-attributes',
    'rpc-spans', 'sampling-extrapolation', 'serverless-spans',
  ],
  'dt-obs-hosts': [
    'container-monitoring', 'host-metrics', 'inventory-discovery', 'process-monitoring',
  ],
  'dt-obs-kubernetes': [
    'cluster-inventory', 'ingress', 'labels-annotations', 'network-policies',
    'pod-debugging', 'pod-node-placement', 'pv-pvc', 'workload-health',
  ],
  'dt-obs-aws': [
    'README', 'capacity-planning', 'cost-optimization', 'database-monitoring', 'events',
    'load-balancing-api', 'messaging-event-streaming', 'metrics-performance',
    'resource-management', 'resource-ownership', 'security-compliance',
    'serverless-containers', 'vpc-networking-security', 'workload-detection',
  ],
  'dt-obs-problems': [
    'impact-analysis', 'problem-correlation', 'problem-merging', 'problem-trending',
  ],
  'dt-app-dashboards': [
    'analyzing', 'create-update', 'layouts', 'tiles', 'variables',
  ],
  'dt-app-notebooks': [
    'analyzing', 'create-update', 'sections',
  ],
  'dt-migration': [
    'README', 'dql-function-migration', 'entity-cloud-application', 'entity-container',
    'entity-host', 'entity-kubernetes', 'entity-process', 'entity-service', 'examples',
    'migration-workflow', 'quick-reference', 'relationship-mappings', 'special-cases',
    'type-mappings',
  ],
};

/**
 * Returns a formatted skill catalog string for inclusion in the system prompt.
 * Contains only skill names and short descriptions (~1200 tokens total).
 */
export function getSkillCatalog(): string {
  const lines = SKILL_CATALOG.map(s => `- **${s.name}**: ${s.description}`);
  return lines.join('\n');
}

/**
 * Loads the full content of a Dynatrace domain skill by name.
 * Returns the skill markdown content, or null if the skill doesn't exist.
 */
export function loadSkill(name: string): string | null {
  if (!VALID_SKILL_NAMES.has(name)) return null;

  const filePath = path.join(SKILLS_DIR, `${name}.md`);
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch {
    // Skill file not readable
  }
  return null;
}

/**
 * Lists available reference file names for a given skill.
 * Returns null if the skill has no references.
 */
export function listSkillReferences(skillName: string): string[] | null {
  return SKILL_REFERENCES[skillName] ?? null;
}

/**
 * Loads a specific reference file for a skill.
 * Returns the file content, or null if not found.
 */
export function loadSkillReference(skillName: string, refName: string): string | null {
  if (!VALID_SKILL_NAMES.has(skillName)) return null;
  const refs = SKILL_REFERENCES[skillName];
  if (!refs || !refs.includes(refName)) return null;

  const filePath = path.join(SKILLS_DIR, skillName, `${refName}.md`);
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch {
    // Reference file not readable
  }
  return null;
}

/**
 * Returns the OpenAI function-calling tool definition for the
 * load_dynatrace_skill_reference tool. Lets the LLM load additional
 * reference material after loading a base skill.
 */
export function getSkillReferenceToolDefinition() {
  return {
    type: 'function' as const,
    function: {
      name: 'load_dynatrace_skill_reference',
      description:
        'Load a detailed reference document for a Dynatrace domain skill. ' +
        'Use this AFTER loading the base skill with load_dynatrace_skill when you need ' +
        'deeper detail on a specific sub-topic (e.g., a particular DQL function category, ' +
        'a specific runtime, or a specific entity type). ' +
        'The base skill file will tell you which references are available.',
      parameters: {
        type: 'object',
        properties: {
          skill_name: {
            type: 'string',
            description: 'The skill identifier that owns the reference.',
            enum: Object.keys(SKILL_REFERENCES),
          },
          reference_name: {
            type: 'string',
            description: 'The reference file name to load (without .md extension). Available references are listed in the base skill.',
          },
        },
        required: ['skill_name', 'reference_name'],
      },
    },
  };
}

/**
 * Returns the OpenAI function-calling tool definition for the
 * load_dynatrace_skill tool. This tool is always registered in the
 * chat handler so the LLM can load domain skills on demand.
 */
export function getSkillToolDefinition() {
  return {
    type: 'function' as const,
    function: {
      name: 'load_dynatrace_skill',
      description:
        'Load a Dynatrace domain skill for detailed knowledge about a specific observability topic. ' +
        'Call this BEFORE answering questions that involve DQL queries, service metrics, logs, traces, ' +
        'hosts, Kubernetes, AWS, problems, dashboards, notebooks, or entity migration. ' +
        'Always load dt-dql-essentials before writing any DQL query. ' +
        'You may load multiple skills per conversation.',
      parameters: {
        type: 'object',
        properties: {
          skill_name: {
            type: 'string',
            description: 'The skill identifier to load.',
            enum: [...VALID_SKILL_NAMES],
          },
        },
        required: ['skill_name'],
      },
    },
  };
}
