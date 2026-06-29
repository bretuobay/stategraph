import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { InspectTraceEvent } from "@stategraph/inspect";
import type { ActorRef, StateGraphEvent } from "@stategraph/core";
import { activateDevtools } from "../devtoolsStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Session {
  actorId: string;
  machineId: string;
  events: InspectTraceEvent[];
  status: "active" | "stopped";
  createdAt: number;
}

interface OverlayState {
  sessions: Record<string, Session>;
  selectedActorId: string | null;
  selectedSeq: number | null;
  isOpen: boolean;
}

type OverlayAction =
  | { type: "TRACE_EVENT"; actorId: string; machineId: string; event: InspectTraceEvent }
  | { type: "SELECT_ACTOR"; actorId: string }
  | { type: "SELECT_EVENT"; seq: number }
  | { type: "TOGGLE" }
  | { type: "CLOSE" };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: OverlayState, action: OverlayAction): OverlayState {
  switch (action.type) {
    case "TRACE_EVENT": {
      const { actorId, machineId, event } = action;
      const existing = state.sessions[actorId];
      const session: Session = existing
        ? {
            ...existing,
            events: [...existing.events, event],
            status: event.type === "@actor.stopped" ? "stopped" : existing.status,
          }
        : { actorId, machineId, events: [event], status: "active", createdAt: Date.now() };
      return {
        ...state,
        sessions: { ...state.sessions, [actorId]: session },
        selectedActorId: state.selectedActorId ?? actorId,
      };
    }
    case "SELECT_ACTOR":
      return { ...state, selectedActorId: action.actorId, selectedSeq: null };
    case "SELECT_EVENT":
      return { ...state, selectedSeq: action.seq };
    case "TOGGLE":
      return { ...state, isOpen: !state.isOpen };
    case "CLOSE":
      return { ...state, isOpen: false };
    default:
      return state;
  }
}

const INITIAL: OverlayState = {
  sessions: {},
  selectedActorId: null,
  selectedSeq: null,
  isOpen: true,
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface DevtoolsOverlayProps {
  /** Whether the panel starts expanded. Default: true. */
  defaultOpen?: boolean;
}

/**
 * Drop-in devtools overlay for StateGraph actors.
 *
 * Mount once near the root of your app during development. Every actor
 * created through `useActor` / `useActorRef` in the same app is automatically
 * discovered — no extra configuration needed.
 *
 * ```tsx
 * // In your app root:
 * {import.meta.env.DEV && <DevtoolsOverlay />}
 * ```
 *
 * Import from the dedicated subpath so the panel is tree-shaken in production:
 * ```ts
 * import { DevtoolsOverlay } from "@stategraph/react/devtools";
 * ```
 */
export function DevtoolsOverlay({ defaultOpen = true }: DevtoolsOverlayProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [state, dispatch] = useReducer(reducer, { ...INITIAL, isOpen: defaultOpen });

  // SSR guard — portals require document
  useEffect(() => setIsMounted(true), []);

  // useLayoutEffect fires before any useEffect in the tree, guaranteeing the
  // handler is set before actors call registerWithDevtools in their useEffect.
  // registered and cleanups live inside the closure so they reset cleanly on
  // StrictMode's unmount/remount cycle — no stale WeakSet entries.
  useLayoutEffect(() => {
    const registered = new Set<ActorRef<unknown, StateGraphEvent>>();
    const cleanups: Array<() => void> = [];

    const deactivate = activateDevtools(
      (actor: ActorRef<unknown, StateGraphEvent>, machineId: string) => {
        if (registered.has(actor)) return;
        registered.add(actor);

        const unsub = actor.inspect((rawEvent) => {
          if (!rawEvent.type.startsWith("@")) return;
          dispatch({
            type: "TRACE_EVENT",
            actorId: rawEvent.actorId,
            machineId,
            event: rawEvent as InspectTraceEvent,
          });
        });
        cleanups.push(unsub);
      },
    );

    return () => {
      deactivate();
      for (const fn of cleanups) fn();
    };
  }, []);

  if (!isMounted) return null;

  const selectedSession =
    state.selectedActorId !== null ? (state.sessions[state.selectedActorId] ?? null) : null;

  const totalEvents = Object.values(state.sessions).reduce((n, s) => n + s.events.length, 0);
  const actorCount = Object.keys(state.sessions).length;

  return createPortal(
    <div
      style={
        {
          "--sg-bg": "#1e1e2e",
          "--sg-surface": "#252537",
          "--sg-surface2": "#2a2a40",
          "--sg-border": "#363650",
          "--sg-text": "#cdd6f4",
          "--sg-dim": "#6c7086",
          "--sg-accent": "#89b4fa",
          "--sg-green": "#a6e3a1",
          "--sg-red": "#f38ba8",
          "--sg-yellow": "#f9e2af",
          "--sg-orange": "#fab387",
          "--sg-purple": "#cba6f7",
          "--sg-teal": "#94e2d5",
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          height: state.isOpen ? 300 : 32,
          background: "var(--sg-bg)",
          borderTop: "1px solid var(--sg-border)",
          fontFamily: "'Menlo','Monaco','Consolas',monospace",
          fontSize: 11,
          color: "var(--sg-text)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "height 150ms ease",
        } as React.CSSProperties
      }
    >
      {/* Toolbar */}
      <div
        style={{
          height: 32,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 10px",
          background: "var(--sg-surface)",
          borderBottom: state.isOpen ? "1px solid var(--sg-border)" : "none",
          cursor: "default",
          userSelect: "none",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--sg-accent)", fontSize: 11 }}>
          ◆ StateGraph DevTools
        </span>
        {actorCount > 0 && (
          <span style={{ color: "var(--sg-dim)", fontSize: 10 }}>
            {actorCount} actor{actorCount !== 1 ? "s" : ""} · {totalEvents} event
            {totalEvents !== 1 ? "s" : ""}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <TinyBtn onClick={() => dispatch({ type: "TOGGLE" })}>{state.isOpen ? "−" : "+"}</TinyBtn>
        <TinyBtn onClick={() => dispatch({ type: "CLOSE" })}>×</TinyBtn>
      </div>

      {/* Content */}
      {state.isOpen && (
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "160px 1fr 220px",
            overflow: "hidden",
          }}
        >
          {/* Actor list */}
          <div
            style={{
              borderRight: "1px solid var(--sg-border)",
              overflowY: "auto",
              background: "var(--sg-surface)",
            }}
          >
            <SectionHeader>Actors</SectionHeader>
            {Object.values(state.sessions).length === 0 ? (
              <div style={{ padding: "8px 10px", color: "var(--sg-dim)" }}>No actors yet</div>
            ) : (
              Object.values(state.sessions).map((session) => {
                const isSelected = session.actorId === state.selectedActorId;
                return (
                  <button
                    key={session.actorId}
                    onClick={() => dispatch({ type: "SELECT_ACTOR", actorId: session.actorId })}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      background: isSelected ? "var(--sg-surface2)" : "transparent",
                      border: "none",
                      borderLeft: `2px solid ${isSelected ? "var(--sg-accent)" : "transparent"}`,
                      padding: "6px 8px",
                      cursor: "pointer",
                      color: "var(--sg-text)",
                      fontFamily: "inherit",
                      fontSize: 10,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        color: isSelected ? "var(--sg-accent)" : "var(--sg-text)",
                      }}
                    >
                      {session.machineId}
                    </div>
                    <div style={{ color: "var(--sg-dim)", marginTop: 1 }}>
                      <span
                        style={{
                          color: session.status === "active" ? "var(--sg-green)" : "var(--sg-dim)",
                        }}
                      >
                        {session.status}
                      </span>
                      {" · "}
                      {session.events.length} events
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Event log */}
          <div style={{ overflowY: "auto" }}>
            {selectedSession ? (
              <EventLog
                events={selectedSession.events}
                selectedSeq={state.selectedSeq}
                onSelect={(seq) => dispatch({ type: "SELECT_EVENT", seq })}
              />
            ) : (
              <Placeholder>
                {actorCount === 0
                  ? "Waiting for actors… make sure useActor / useActorRef is called inside this tree"
                  : "Select an actor"}
              </Placeholder>
            )}
          </div>

          {/* Detail */}
          <div
            style={{
              borderLeft: "1px solid var(--sg-border)",
              overflowY: "auto",
            }}
          >
            {selectedSession && state.selectedSeq !== null ? (
              <EventDetail
                event={selectedSession.events.find((e) => e.seq === state.selectedSeq) ?? null}
              />
            ) : (
              <Placeholder>Click an event</Placeholder>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// EventLog
// ---------------------------------------------------------------------------

const EVENT_COLOR: Record<string, string> = {
  "@actor.started": "var(--sg-green)",
  "@actor.stopped": "var(--sg-dim)",
  "@event.received": "var(--sg-accent)",
  "@transition.fired": "var(--sg-purple)",
  "@action.executed": "var(--sg-teal)",
  "@context.updated": "var(--sg-teal)",
  "@effect.started": "var(--sg-yellow)",
  "@effect.done": "var(--sg-green)",
  "@effect.error": "var(--sg-red)",
  "@effect.cancelled": "var(--sg-orange)",
  "@error": "var(--sg-red)",
};

const EVENT_LABEL: Record<string, string> = {
  "@actor.started": "started",
  "@actor.stopped": "stopped",
  "@event.received": "event",
  "@transition.fired": "transition",
  "@action.executed": "action",
  "@context.updated": "context",
  "@effect.started": "effect↑",
  "@effect.done": "effect✓",
  "@effect.error": "effect✗",
  "@effect.cancelled": "effect⊘",
  "@error": "error",
};

function eventSummary(event: InspectTraceEvent): string {
  switch (event.type) {
    case "@event.received":
      return (event.event as { type: string }).type;
    case "@transition.fired":
      return `${last(event.source)} → ${event.target ? last(event.target) : "(self)"}`;
    case "@action.executed":
      return event.actionType;
    case "@effect.started":
      return event.src;
    case "@effect.done":
    case "@effect.error":
    case "@effect.cancelled":
      return event.effectId;
    case "@context.updated":
      return Object.keys(event.patch as object).join(", ");
    default:
      return "";
  }
}

function last(dotPath: string): string {
  return dotPath.split(".").at(-1) ?? dotPath;
}

function fmtTs(ts: number): string {
  return ts < 1000 ? `${ts}ms` : `${(ts / 1000).toFixed(1)}s`;
}

function EventLog({
  events,
  selectedSeq,
  onSelect,
}: {
  events: InspectTraceEvent[];
  selectedSeq: number | null;
  onSelect: (seq: number) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ position: "sticky", top: 0, background: "var(--sg-surface)", zIndex: 1 }}>
          {(["#", "time", "type", "detail"] as const).map((h) => (
            <th
              key={h}
              style={{
                padding: "3px 6px",
                textAlign: "left",
                color: "var(--sg-dim)",
                fontWeight: 400,
                fontSize: 10,
                borderBottom: "1px solid var(--sg-border)",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {events.map((event) => {
          const isSelected = event.seq === selectedSeq;
          const color = EVENT_COLOR[event.type] ?? "var(--sg-dim)";
          return (
            <tr
              key={event.seq}
              onClick={() => onSelect(event.seq)}
              style={{
                background: isSelected ? "var(--sg-surface2)" : "transparent",
                cursor: "pointer",
                borderBottom: "1px solid var(--sg-border)",
              }}
            >
              <td style={{ padding: "3px 6px", color: "var(--sg-dim)", textAlign: "right" }}>
                {event.seq}
              </td>
              <td style={{ padding: "3px 6px", color: "var(--sg-dim)" }}>{fmtTs(event.ts)}</td>
              <td style={{ padding: "3px 6px", color }}>{EVENT_LABEL[event.type] ?? event.type}</td>
              <td
                style={{
                  padding: "3px 6px",
                  color: "var(--sg-dim)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 120,
                }}
              >
                {eventSummary(event)}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={4}>
            <div ref={bottomRef} />
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

// ---------------------------------------------------------------------------
// EventDetail
// ---------------------------------------------------------------------------

function EventDetail({ event }: { event: InspectTraceEvent | null }) {
  if (!event) return <Placeholder>No event selected</Placeholder>;

  return (
    <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ color: EVENT_COLOR[event.type] ?? "var(--sg-dim)", fontWeight: 600 }}>
        {event.type}
      </div>
      <Field label="seq" value={String(event.seq)} />
      <Field label="ts" value={fmtTs(event.ts)} />
      <EventFields event={event} />
    </div>
  );
}

function EventFields({ event }: { event: InspectTraceEvent }) {
  switch (event.type) {
    case "@event.received":
      return <Field label="event" value={JSON.stringify(event.event)} mono />;

    case "@transition.fired":
      return (
        <>
          <Field label="source" value={last(event.source)} mono />
          <Field label="target" value={event.target ? last(event.target) : "(self)"} mono />
          {Object.entries(event.guardResults).map(([name, result]) => (
            <div key={name} style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ color: "var(--sg-dim)", fontSize: 10 }}>guard</span>
              <span style={{ fontFamily: "monospace" }}>{name}</span>
              <span
                style={{
                  padding: "0 4px",
                  borderRadius: 2,
                  fontSize: 10,
                  color: result ? "var(--sg-green)" : "var(--sg-red)",
                  background: result ? "rgba(166,227,161,.15)" : "rgba(243,139,168,.15)",
                }}
              >
                {String(result)}
              </span>
            </div>
          ))}
        </>
      );

    case "@action.executed":
      return (
        <>
          <Field label="action" value={event.actionType} mono />
          {event.params !== undefined && (
            <Field label="params" value={JSON.stringify(event.params)} mono />
          )}
        </>
      );

    case "@effect.started":
      return (
        <>
          <Field label="src" value={event.src} mono />
          <Field label="id" value={event.effectId} mono />
          {event.input !== undefined && (
            <Field label="input" value={JSON.stringify(event.input)} mono />
          )}
        </>
      );

    case "@effect.done":
      return (
        <>
          <Field label="id" value={event.effectId} mono />
          <Field label="output" value={JSON.stringify(event.output)} mono />
        </>
      );

    case "@effect.error":
      return (
        <>
          <Field label="id" value={event.effectId} mono />
          <Field label="error" value={JSON.stringify(event.error)} mono color="var(--sg-red)" />
        </>
      );

    case "@effect.cancelled":
      return <Field label="id" value={event.effectId} mono />;

    case "@context.updated":
      return <Field label="patch" value={JSON.stringify(event.patch)} mono />;

    case "@error":
      return <Field label="error" value={JSON.stringify(event.error)} mono color="var(--sg-red)" />;

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "4px 8px",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "var(--sg-dim)",
        borderBottom: "1px solid var(--sg-border)",
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  color,
}: {
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--sg-dim)" }}>{label}</div>
      <div
        style={{
          fontFamily: mono ? "monospace" : "inherit",
          color: color ?? "var(--sg-text)",
          fontSize: 10,
          overflowWrap: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TinyBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        color: "var(--sg-dim)",
        cursor: "pointer",
        fontSize: 14,
        lineHeight: 1,
        padding: "0 4px",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "var(--sg-dim)",
        padding: 12,
        textAlign: "center",
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
