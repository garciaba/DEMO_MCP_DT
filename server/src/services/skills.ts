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
 * Updated to v3.0.0 from github.com/Dynatrace/dynatrace-for-ai
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
    name: 'dt-obs-azure',
    description: 'Azure resources: VMs, VMSS, SQL Database, Storage, AKS, App Service, Functions, VNet, Event Hubs, Container Apps, and Key Vault.',
  },
  {
    name: 'dt-obs-gcp',
    description: 'GCP resources: Compute Engine, GKE, Cloud Run, Pub/Sub, VPC, DNS, IAM, and Secret Manager.',
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
    name: 'dt-obs-predictive-analytics',
    description: 'Time series forecasting, capacity saturation planning, and trend/anomaly detection across hosts, services, and infrastructure.',
  },
  {
    name: 'dt-alerting',
    description: 'End-to-end alerting lifecycle: anomaly detector setup, alert events in Grail, problem grouping, and workflow notification routing.',
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
    name: 'dt-js-runtime',
    description: 'Dynatrace server-side JavaScript runtime: function contract, runtime limits, Web APIs, Node.js modules, and the @dynatrace-sdk/* catalog.',
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
    'csp-violations', 'error-tracking', 'mobile-monitoring', 'slow-page-load-playbook',
    'troubleshooting', 'user-actions', 'user-sessions', 'visibility-changes',
    'web-performance-analysis', 'web-vitals',
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
    'capacity-planning', 'cost-optimization', 'database-monitoring', 'events',
    'load-balancing-api', 'messaging-event-streaming', 'metrics-performance',
    'resource-management', 'resource-ownership', 'security-compliance',
    'serverless-containers', 'vpc-networking-security', 'workload-detection',
  ],
  'dt-obs-azure': [
    'README', 'capacity-planning', 'cost-optimization', 'database-monitoring',
    'load-balancing-api', 'messaging-integration', 'metrics-performance',
    'resource-management', 'resource-ownership', 'security-compliance',
    'serverless-containers', 'storage-monitoring', 'vnet-networking-security',
    'workload-detection',
  ],
  'dt-obs-gcp': [
    'README', 'compute-instances', 'iam-security', 'kubernetes-gke',
    'messaging-pubsub', 'monitoring-logging', 'networking-dns',
    'resource-management', 'resource-ownership', 'serverless-containers',
  ],
  'dt-obs-problems': [
    'impact-analysis', 'problem-correlation', 'problem-merging', 'problem-trending',
  ],
  'dt-obs-predictive-analytics': [
    'anomaly-scoring', 'capacity-forecasting', 'forecasting-analyzer',
    'novelty-detection', 'trend-detection',
  ],
  'dt-alerting': [
    'anomaly-detectors', 'davis-events', 'workflow-notifications',
  ],
  'dt-app-dashboards': [
    'analyzing', 'create-update', 'tiles', 'variables',
  ],
  'dt-app-notebooks': [
    'analyzing', 'create-update', 'sections',
  ],
  'dt-js-runtime': [
    'apis-and-modules', 'fetch', 'limits-and-restrictions', 'sdk',
    'sdks--app-engine-registry--README', 'sdks--app-engine-registry--appEngineRegistryAppsClient',
    'sdks--app-engine-registry--appEngineRegistrySchemaManifestClient', 'sdks--app-engine-registry--types',
    'sdks--app-environment--README', 'sdks--app-environment--functions', 'sdks--app-environment--types',
    'sdks--app-settings-v1--README', 'sdks--app-settings-v1--appSettingsObjectsClient', 'sdks--app-settings-v1--types',
    'sdks--app-settings-v2--README', 'sdks--app-settings-v2--appSettingsObjectsClient', 'sdks--app-settings-v2--types',
    'sdks--app-utils--README',
    'sdks--automation--README', 'sdks--automation--actionExecutionsClient', 'sdks--automation--actionsSampleResultClient',
    'sdks--automation--businessCalendarsClient', 'sdks--automation--eventTriggersClient',
    'sdks--automation--executionsClient', 'sdks--automation--schedulesClient',
    'sdks--automation--schedulingRulesClient', 'sdks--automation--settingsClient',
    'sdks--automation--types', 'sdks--automation--versionClient',
    'sdks--automation--webhookHandlersClient', 'sdks--automation--workflowsClient',
    'sdks--automation-utils--README', 'sdks--automation-utils--constants',
    'sdks--automation-utils--functions', 'sdks--automation-utils--types',
    'sdks--bucket-management--README', 'sdks--bucket-management--bucketDefinitionsClient', 'sdks--bucket-management--types',
    'sdks--classic-environment-v1--README', 'sdks--classic-environment-v1--cluster',
    'sdks--classic-environment-v1--deployment', 'sdks--classic-environment-v1--oneagent-on-host',
    'sdks--classic-environment-v1--rum-javascript-tags', 'sdks--classic-environment-v1--rum-user-sessions',
    'sdks--classic-environment-v1--synthetic', 'sdks--classic-environment-v1--types',
    'sdks--classic-environment-v2--README', 'sdks--classic-environment-v2--access-tokens',
    'sdks--classic-environment-v2--activegates', 'sdks--classic-environment-v2--audit-logs',
    'sdks--classic-environment-v2--credential-vault', 'sdks--classic-environment-v2--entities',
    'sdks--classic-environment-v2--events', 'sdks--classic-environment-v2--extensions',
    'sdks--classic-environment-v2--logs', 'sdks--classic-environment-v2--metrics',
    'sdks--classic-environment-v2--network-zones', 'sdks--classic-environment-v2--problems',
    'sdks--classic-environment-v2--releases-and-rum', 'sdks--classic-environment-v2--security',
    'sdks--classic-environment-v2--settings', 'sdks--classic-environment-v2--slo',
    'sdks--classic-environment-v2--synthetic', 'sdks--classic-environment-v2--types',
    'sdks--davis-analyzers--README', 'sdks--davis-analyzers--analyzersClient', 'sdks--davis-analyzers--types',
    'sdks--document--README', 'sdks--document--directSharesClient', 'sdks--document--documentLockingClient',
    'sdks--document--documentsClient', 'sdks--document--environmentSharesClient',
    'sdks--document--trashClient', 'sdks--document--types',
    'sdks--edge-connect--README', 'sdks--edge-connect--edgeConnectClient', 'sdks--edge-connect--types',
    'sdks--filter-segments--README', 'sdks--filter-segments--filterSegmentsClient', 'sdks--filter-segments--types',
    'sdks--hub--README', 'sdks--hub--appsClient', 'sdks--hub--categoriesClient',
    'sdks--hub--extensionsClient', 'sdks--hub--technologiesClient', 'sdks--hub--types',
    'sdks--iam--README', 'sdks--iam--types', 'sdks--iam--usersAndGroupsClient',
    'sdks--navigation--README', 'sdks--navigation--functions', 'sdks--navigation--types',
    'sdks--notification-v1--README', 'sdks--notification-v1--selfNotificationsClient', 'sdks--notification-v1--types',
    'sdks--notification-v2--README', 'sdks--notification-v2--eventNotificationsClient',
    'sdks--notification-v2--resourceNotificationsClient', 'sdks--notification-v2--types',
    'sdks--platform-management--README', 'sdks--platform-management--effectivePermissionsClient',
    'sdks--platform-management--environmentInformationClient', 'sdks--platform-management--environmentSettingsClient',
    'sdks--platform-management--licenseInformationClient', 'sdks--platform-management--types',
    'sdks--query--README', 'sdks--query--queryAssistanceClient', 'sdks--query--queryExecutionClient', 'sdks--query--types',
    'sdks--react-hooks--README', 'sdks--react-hooks--hooks', 'sdks--react-hooks--types',
    'sdks--resource-store--README', 'sdks--resource-store--lookupDataClient', 'sdks--resource-store--types',
    'sdks--state--README', 'sdks--state--stateClient', 'sdks--state--types',
    'sdks--units--README', 'sdks--units--constants', 'sdks--units--functions',
    'sdks--user-preferences--README',
  ],
  'dt-migration': [
    'README', 'auto-tagging-field-mapping', 'dql-function-migration', 'entity-cloud-application',
    'entity-container', 'entity-host', 'entity-kubernetes', 'entity-process',
    'entity-selector-predicates', 'entity-service', 'examples', 'mass-data-filtering-strategy',
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
        'hosts, Kubernetes, AWS, Azure, GCP, problems, alerting, dashboards, notebooks, ' +
        'predictive analytics, the Dynatrace JS runtime, or entity migration. ' +
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
