export const STATEGRAPH_INSPECT_PACKAGE = "@stategraph/inspect";

// Schema — types for the discriminated trace event union and envelope
export type {
  ActorStartedTrace,
  ActorStoppedTrace,
  ActionExecutedTrace,
  ContextUpdatedTrace,
  EffectCancelledTrace,
  EffectDoneTrace,
  EffectErrorTrace,
  EffectStartedTrace,
  EventReceivedTrace,
  InspectTraceEvent,
  RuntimeErrorTrace,
  TraceEnvelope,
  TransitionFiredTrace,
} from "./schema";
export { CURRENT_SCHEMA_VERSION, SUPPORTED_MAJOR_VERSIONS } from "./schema";

// Validate — parse, serialize, deserialize
export {
  deserializeEnvelope,
  InvalidTraceEnvelopeError,
  parseTraceEnvelope,
  serializeEnvelope,
  UnsupportedSchemaVersionError,
} from "./validate";

// Recorder — attach to an actor and collect a trace envelope
export { createTraceRecorder } from "./recorder";
export type { TraceRecorder, TraceRecorderOptions } from "./recorder";

// Transport — devtools bridge over a generic channel
export { createDevtoolsBridge, isBridgeMessage } from "./transport";
export type {
  BridgeMessage,
  DevtoolsBridge,
  DevtoolsBridgeOptions,
  InspectChannel,
  TraceEventMessage,
  TraceSnapshotMessage,
} from "./transport";

// Replay — deterministic replay of a trace envelope against a fresh actor
export { replayTrace } from "./replay";
export type { ReplayOptions, ReplayResult } from "./replay";
