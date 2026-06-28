export const CURRENT_SCHEMA_VERSION = "1.0";
export const SUPPORTED_MAJOR_VERSIONS: readonly string[] = ["1"];

// ---------------------------------------------------------------------------
// Base fields present on every emitted trace event (matches what core emits)
// ---------------------------------------------------------------------------

interface BaseTrace {
  readonly seq: number;
  readonly ts: number;
  readonly actorId: string;
}

// ---------------------------------------------------------------------------
// Specific trace event shapes — mirror exactly what actor.ts emits
// ---------------------------------------------------------------------------

export interface ActorStartedTrace extends BaseTrace {
  readonly type: "@actor.started";
  readonly snapshot: unknown;
}

export interface ActorStoppedTrace extends BaseTrace {
  readonly type: "@actor.stopped";
}

export interface EventReceivedTrace extends BaseTrace {
  readonly type: "@event.received";
  readonly event: unknown;
}

export interface TransitionFiredTrace extends BaseTrace {
  readonly type: "@transition.fired";
  readonly source: string;
  readonly target: string | null;
  readonly eventType: string;
  readonly guardResults: Record<string, boolean>;
}

export interface ActionExecutedTrace extends BaseTrace {
  readonly type: "@action.executed";
  readonly actionType: string;
  readonly params: unknown;
}

export interface EffectStartedTrace extends BaseTrace {
  readonly type: "@effect.started";
  readonly effectId: string;
  readonly src: string;
  readonly input: unknown;
}

export interface EffectDoneTrace extends BaseTrace {
  readonly type: "@effect.done";
  readonly effectId: string;
  readonly output: unknown;
}

export interface EffectErrorTrace extends BaseTrace {
  readonly type: "@effect.error";
  readonly effectId: string;
  readonly error: unknown;
}

export interface EffectCancelledTrace extends BaseTrace {
  readonly type: "@effect.cancelled";
  readonly effectId: string;
}

export interface ContextUpdatedTrace extends BaseTrace {
  readonly type: "@context.updated";
  readonly patch: unknown;
}

export interface RuntimeErrorTrace extends BaseTrace {
  readonly type: "@error";
  readonly error: unknown;
}

/**
 * Discriminated union of all trace events emitted by the StateGraph runtime.
 * Narrower refinement of core's loose `TraceEvent` type.
 */
export type InspectTraceEvent =
  | ActorStartedTrace
  | ActorStoppedTrace
  | EventReceivedTrace
  | TransitionFiredTrace
  | ActionExecutedTrace
  | EffectStartedTrace
  | EffectDoneTrace
  | EffectErrorTrace
  | EffectCancelledTrace
  | ContextUpdatedTrace
  | RuntimeErrorTrace;

// ---------------------------------------------------------------------------
// Trace envelope — container for a full recorded session
// ---------------------------------------------------------------------------

export interface TraceEnvelope {
  /** 'MAJOR.MINOR' — MAJOR bump = breaking change. */
  readonly schemaVersion: string;
  /** UUIDv4 — unique per actor lifecycle recording session. */
  readonly sessionId: string;
  readonly machineId: string;
  readonly actorId: string;
  /** Unix timestamp (ms) when recording started. */
  readonly createdAt: number;
  readonly events: InspectTraceEvent[];
}
