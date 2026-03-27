/**
 * OpenTelemetry initialization.
 *
 * ⚠️  This module MUST be imported before any other application module
 *     so that HTTP instrumentation can patch modules before they are loaded.
 *
 * The exporter can be reconfigured at runtime via `reconfigureTelemetry()`.
 */

// ── Load .env FIRST — must happen before reading any env vars ─
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import { trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SimpleSpanProcessor, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-node';
import type { ExportResult } from '@opentelemetry/core';

// ─── Configuration ───────────────────────────────────────────
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? 'dynatrace-observability-assistant';
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION ?? '1.0.0';

// Parse "key=val,key2=val2" into a Record
function parseHeaders(raw: string): Record<string, string> {
  if (!raw) return {};
  const headers: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      headers[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
  }
  return headers;
}

function buildOtlpHeaders(token: string): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Api-Token ${token}` };
}

// ─── Delegating Exporter ─────────────────────────────────────
// Wraps a real OTLP exporter so we can swap it at runtime when
// the user changes the endpoint/token from the UI.

class DelegatingSpanExporter implements SpanExporter {
  private _delegate: SpanExporter | null = null;

  setDelegate(exporter: SpanExporter | null) {
    this._delegate = exporter;
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    if (this._delegate) {
      this._delegate.export(spans, resultCallback);
    } else {
      // No exporter configured — just succeed silently
      resultCallback({ code: 0 });
    }
  }

  async shutdown(): Promise<void> {
    return this._delegate?.shutdown();
  }

  async forceFlush(): Promise<void> {
    return this._delegate?.forceFlush?.();
  }
}

// ─── State ───────────────────────────────────────────────────
const delegatingExporter = new DelegatingSpanExporter();

let currentConfig = {
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '',
  apiToken: '',   // extracted from OTEL_EXPORTER_OTLP_HEADERS
  enabled: false,
};

// Bootstrap from env vars
const envHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS ?? '';
console.log(
  `[telemetry] Bootstrap: endpoint=${currentConfig.endpoint || '(not set)'}, headers=${envHeaders ? 'present' : '(not set)'}`,
);

if (currentConfig.endpoint && envHeaders) {
  const parsed = parseHeaders(envHeaders);
  const authHeader = parsed['Authorization'] ?? '';
  const token = authHeader.replace(/^Api-Token\s+/i, '');
  if (token) {
    currentConfig.apiToken = token;
    currentConfig.enabled = true;

    delegatingExporter.setDelegate(
      new OTLPTraceExporter({
        url: `${currentConfig.endpoint}/v1/traces`,
        headers: parsed,
      }),
    );
  }
}

// ─── OpenTelemetry SDK ───────────────────────────────────────
const isDev = (process.env.NODE_ENV ?? 'development') === 'development';

const sdk = new NodeSDK({
  spanProcessors: [
    isDev
      ? new SimpleSpanProcessor(delegatingExporter)
      : new BatchSpanProcessor(delegatingExporter),
  ],
  instrumentations: [
    new HttpInstrumentation(),
  ],
});

sdk.start();
console.log(`[telemetry] SDK started (dev=${isDev}, enabled=${currentConfig.enabled})`);

// ─── Exported tracer for manual spans ────────────────────────
export const tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION);

// ─── Runtime reconfiguration ─────────────────────────────────

export interface TelemetryConfig {
  endpoint: string;
  apiToken: string;
  enabled: boolean;
}

export function getTelemetryConfig(): TelemetryConfig {
  return { ...currentConfig };
}

export function reconfigureTelemetry(config: TelemetryConfig): void {
  currentConfig = { ...config };

  if (!config.enabled || !config.endpoint || !config.apiToken) {
    delegatingExporter.setDelegate(null);
    currentConfig.enabled = false;
    return;
  }

  const headers = buildOtlpHeaders(config.apiToken);

  delegatingExporter.setDelegate(
    new OTLPTraceExporter({
      url: `${config.endpoint}/v1/traces`,
      headers,
    }),
  );

  currentConfig.enabled = true;
}

// ─── Graceful shutdown ──────────────────────────────────────
async function shutdownTelemetry() {
  try {
    await sdk.shutdown();
  } catch {
    // best-effort
  }
}

process.on('SIGTERM', shutdownTelemetry);
process.on('SIGINT', shutdownTelemetry);
