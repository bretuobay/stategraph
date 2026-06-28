import {
  SUPPORTED_MAJOR_VERSIONS,
  type InspectTraceEvent,
  type TraceEnvelope,
} from "./schema";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class UnsupportedSchemaVersionError extends Error {
  constructor(
    public readonly version: string,
    public readonly supported: readonly string[],
  ) {
    super(
      `Unsupported trace schema version "${version}". ` +
        `Supported major versions: ${supported.map((v) => `${v}.x`).join(", ")}.`,
    );
    this.name = "UnsupportedSchemaVersionError";
  }
}

export class InvalidTraceEnvelopeError extends Error {
  constructor(message: string) {
    super(`Invalid trace envelope: ${message}`);
    this.name = "InvalidTraceEnvelopeError";
  }
}

// ---------------------------------------------------------------------------
// Known trace event types — used for runtime narrowing
// ---------------------------------------------------------------------------

const KNOWN_TRACE_EVENT_TYPES = new Set([
  "@actor.started",
  "@actor.stopped",
  "@event.received",
  "@transition.fired",
  "@action.executed",
  "@effect.started",
  "@effect.done",
  "@effect.error",
  "@effect.cancelled",
  "@context.updated",
  "@error",
]);

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBaseTrace(value: unknown): value is {
  seq: number;
  ts: number;
  actorId: string;
  type: string;
} {
  if (!isRecord(value)) return false;
  return (
    typeof value["seq"] === "number" &&
    typeof value["ts"] === "number" &&
    typeof value["actorId"] === "string" &&
    typeof value["type"] === "string"
  );
}

/**
 * Narrows a raw object to a known InspectTraceEvent.
 * Unknown event types (forward-compatibility additions) are dropped.
 */
function narrowTraceEvent(value: unknown): InspectTraceEvent | null {
  if (!isBaseTrace(value)) return null;
  if (!KNOWN_TRACE_EVENT_TYPES.has(value.type)) return null;
  return value as InspectTraceEvent;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses and validates a raw (deserialized) trace envelope.
 *
 * - Throws `UnsupportedSchemaVersionError` if the MAJOR version is unknown.
 * - Throws `InvalidTraceEnvelopeError` if required fields are missing or malformed.
 * - Unknown event types in `events` are silently dropped (forward-compatibility).
 */
export function parseTraceEnvelope(raw: unknown): TraceEnvelope {
  if (!isRecord(raw)) {
    throw new InvalidTraceEnvelopeError("expected an object");
  }

  // Version check first — enables version-specific parsing branches in future.
  const version = raw["schemaVersion"];
  if (typeof version !== "string" || !version) {
    throw new InvalidTraceEnvelopeError(`"schemaVersion" must be a non-empty string`);
  }
  const major = version.split(".")[0] ?? "";
  if (!SUPPORTED_MAJOR_VERSIONS.includes(major)) {
    throw new UnsupportedSchemaVersionError(version, SUPPORTED_MAJOR_VERSIONS);
  }

  if (typeof raw["sessionId"] !== "string" || !raw["sessionId"]) {
    throw new InvalidTraceEnvelopeError(`"sessionId" must be a non-empty string`);
  }
  if (typeof raw["machineId"] !== "string" || !raw["machineId"]) {
    throw new InvalidTraceEnvelopeError(`"machineId" must be a non-empty string`);
  }
  if (typeof raw["actorId"] !== "string" || !raw["actorId"]) {
    throw new InvalidTraceEnvelopeError(`"actorId" must be a non-empty string`);
  }
  if (typeof raw["createdAt"] !== "number") {
    throw new InvalidTraceEnvelopeError(`"createdAt" must be a number`);
  }
  if (!Array.isArray(raw["events"])) {
    throw new InvalidTraceEnvelopeError(`"events" must be an array`);
  }

  const events: InspectTraceEvent[] = [];
  for (const item of raw["events"] as unknown[]) {
    const narrowed = narrowTraceEvent(item);
    if (narrowed) events.push(narrowed);
  }

  return {
    schemaVersion: version,
    sessionId: raw["sessionId"] as string,
    machineId: raw["machineId"] as string,
    actorId: raw["actorId"] as string,
    createdAt: raw["createdAt"] as number,
    events,
  };
}

/**
 * Serializes a TraceEnvelope to a JSON string.
 */
export function serializeEnvelope(envelope: TraceEnvelope): string {
  return JSON.stringify(envelope);
}

/**
 * Deserializes and validates a JSON string to a TraceEnvelope.
 */
export function deserializeEnvelope(json: string): TraceEnvelope {
  let raw: unknown;
  try {
    raw = JSON.parse(json) as unknown;
  } catch {
    throw new InvalidTraceEnvelopeError("invalid JSON");
  }
  return parseTraceEnvelope(raw);
}
