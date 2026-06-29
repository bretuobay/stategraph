import { assign, setup } from "@stategraph/core";
import type { InspectTraceEvent, TraceEnvelope } from "@stategraph/inspect";

export interface SessionData {
  actorId: string;
  machineId: string;
  sessionId: string;
  events: InspectTraceEvent[];
  status: "active" | "stopped";
  createdAt: number;
}

export interface DevtoolsContext {
  sessions: Record<string, SessionData>;
}

export type DevtoolsEvent =
  | {
      type: "TRACE_RECEIVED";
      machineId: string;
      sessionId: string;
      actorId: string;
      event: InspectTraceEvent;
    }
  | { type: "IMPORT"; envelope: TraceEnvelope }
  | { type: "CLEAR" }
  | { type: "CONNECT_LIVE" };

export const devtoolsMachine = setup<DevtoolsContext, DevtoolsEvent>({
  actions: {
    appendTraceEvent: assign(({ context, event }) => {
      if (event.type !== "TRACE_RECEIVED") return {};
      const { actorId, machineId, sessionId } = event;
      const traceEvent = event.event;
      const existing = context.sessions[actorId];
      const next: SessionData = existing
        ? {
            ...existing,
            events: [...existing.events, traceEvent],
            status: traceEvent.type === "@actor.stopped" ? "stopped" : existing.status,
          }
        : {
            actorId,
            machineId,
            sessionId,
            events: [traceEvent],
            status: "active" as const,
            createdAt: Date.now(),
          };
      return { sessions: { ...context.sessions, [actorId]: next } };
    }),

    loadEnvelope: assign(({ context, event }) => {
      if (event.type !== "IMPORT") return {};
      const { envelope } = event;
      return {
        sessions: {
          ...context.sessions,
          [envelope.actorId]: {
            actorId: envelope.actorId,
            machineId: envelope.machineId,
            sessionId: envelope.sessionId,
            events: [...envelope.events],
            status: "stopped" as const,
            createdAt: envelope.createdAt,
          },
        },
      };
    }),

    clearAll: assign(() => ({ sessions: {} })),
  },
}).createMachine({
  id: "devtools",
  initial: "idle",
  context: { sessions: {} },
  states: {
    idle: {
      on: {
        CONNECT_LIVE: { target: "listening" },
        IMPORT: { target: "active", actions: ["loadEnvelope"] },
      },
    },
    listening: {
      on: {
        TRACE_RECEIVED: { target: "active", actions: ["appendTraceEvent"] },
        CLEAR: { target: "idle", actions: ["clearAll"] },
      },
    },
    active: {
      on: {
        TRACE_RECEIVED: { actions: ["appendTraceEvent"] },
        IMPORT: { actions: ["loadEnvelope"] },
        CLEAR: { target: "idle", actions: ["clearAll"] },
        CONNECT_LIVE: {},
      },
    },
  },
});
