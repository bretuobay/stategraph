import type { InspectTraceEvent } from "@stategraph/inspect";
import type { SessionData } from "../machine";

interface DetailPanelProps {
  session: SessionData | null;
  selectedSeq: number | null;
}

export function DetailPanel({ session, selectedSeq }: DetailPanelProps) {
  if (!session) {
    return <EmptyMessage text="Select an actor to inspect" />;
  }

  // Derive current state from the last transition or actor.started
  const currentStates = deriveCurrentStates(session.events);

  // Derive current context by replaying patches
  const currentContext = deriveContext(session.events);

  // Find the selected event
  const selectedEvent =
    selectedSeq !== null ? (session.events.find((e) => e.seq === selectedSeq) ?? null) : null;

  return (
    <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
      {/* State section */}
      <Section label="Active States">
        {currentStates.length === 0 ? (
          <Dim>—</Dim>
        ) : (
          currentStates.map((s) => <StateChip key={s}>{s}</StateChip>)
        )}
      </Section>

      {/* Context section */}
      <Section label="Context">
        {Object.keys(currentContext).length === 0 ? (
          <Dim>—</Dim>
        ) : (
          <pre
            style={{
              margin: 0,
              padding: "6px 0",
              color: "var(--dt-text)",
              fontSize: 11,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {JSON.stringify(currentContext, null, 2)}
          </pre>
        )}
      </Section>

      {/* Selected event detail */}
      <Section label={selectedEvent ? `Event #${selectedEvent.seq}` : "Event Detail"} grow>
        {selectedEvent ? (
          <EventDetail event={selectedEvent} />
        ) : (
          <Dim>Click an event in the log</Dim>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event detail renderer
// ---------------------------------------------------------------------------

function EventDetail({ event }: { event: InspectTraceEvent }) {
  switch (event.type) {
    case "@actor.started":
      return (
        <Fields>
          <Field label="actorId" value={event.actorId} />
          <Field label="ts" value={`${event.ts}ms`} />
          <Field label="snapshot" value={JSON.stringify(event.snapshot, null, 2)} mono block />
        </Fields>
      );

    case "@actor.stopped":
      return (
        <Fields>
          <Field label="actorId" value={event.actorId} />
          <Field label="ts" value={`${event.ts}ms`} />
        </Fields>
      );

    case "@event.received":
      return (
        <Fields>
          <Field label="event" value={JSON.stringify(event.event, null, 2)} mono block />
        </Fields>
      );

    case "@transition.fired":
      return (
        <Fields>
          <Field label="source" value={event.source} mono />
          <Field
            label="target"
            value={event.target ?? "(self / targetless)"}
            mono
            dim={!event.target}
          />
          <Field label="event" value={event.eventType} mono />
          {Object.keys(event.guardResults).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <FieldLabel>Guards</FieldLabel>
              {Object.entries(event.guardResults).map(([name, result]) => (
                <div
                  key={name}
                  style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}
                >
                  <span style={{ color: "var(--dt-text)", fontFamily: "monospace" }}>{name}</span>
                  <span
                    style={{
                      padding: "1px 5px",
                      borderRadius: 3,
                      fontSize: 10,
                      background: result ? "rgba(166,227,161,0.15)" : "rgba(243,139,168,0.15)",
                      color: result ? "var(--dt-green)" : "var(--dt-red)",
                    }}
                  >
                    {String(result)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Fields>
      );

    case "@action.executed":
      return (
        <Fields>
          <Field label="type" value={event.actionType} mono />
          {event.params !== undefined && (
            <Field label="params" value={JSON.stringify(event.params, null, 2)} mono block />
          )}
        </Fields>
      );

    case "@effect.started":
      return (
        <Fields>
          <Field label="effectId" value={event.effectId} mono />
          <Field label="src" value={event.src} mono />
          {event.input !== undefined && (
            <Field label="input" value={JSON.stringify(event.input, null, 2)} mono block />
          )}
        </Fields>
      );

    case "@effect.done":
      return (
        <Fields>
          <Field label="effectId" value={event.effectId} mono />
          <Field label="output" value={JSON.stringify(event.output, null, 2)} mono block />
        </Fields>
      );

    case "@effect.error":
      return (
        <Fields>
          <Field label="effectId" value={event.effectId} mono />
          <Field
            label="error"
            value={JSON.stringify(event.error, null, 2)}
            mono
            block
            color="var(--dt-red)"
          />
        </Fields>
      );

    case "@effect.cancelled":
      return (
        <Fields>
          <Field label="effectId" value={event.effectId} mono />
        </Fields>
      );

    case "@context.updated":
      return (
        <Fields>
          <Field label="patch" value={JSON.stringify(event.patch, null, 2)} mono block />
        </Fields>
      );

    case "@error":
      return (
        <Fields>
          <Field
            label="error"
            value={JSON.stringify(event.error, null, 2)}
            mono
            block
            color="var(--dt-red)"
          />
        </Fields>
      );

    default:
      return <Dim>Unknown event type</Dim>;
  }
}

// ---------------------------------------------------------------------------
// Helpers: derive state and context from trace events
// ---------------------------------------------------------------------------

function deriveCurrentStates(events: InspectTraceEvent[]): string[] {
  let states: string[] = [];

  for (const event of events) {
    if (event.type === "@actor.started") {
      const snap = event.snapshot as { configuration?: unknown } | undefined;
      if (Array.isArray(snap?.configuration)) {
        states = snap.configuration as string[];
      } else if (snap?.configuration instanceof Set) {
        states = [...(snap.configuration as Set<string>)];
      }
    } else if (event.type === "@transition.fired" && event.target) {
      states = [event.target];
    } else if (event.type === "@actor.stopped") {
      states = [];
    }
  }

  return states.map((s) => s.split(".").slice(1).join(".") || s);
}

function deriveContext(events: InspectTraceEvent[]): Record<string, unknown> {
  let context: Record<string, unknown> = {};

  for (const event of events) {
    if (event.type === "@actor.started") {
      const snap = event.snapshot as { context?: Record<string, unknown> } | undefined;
      if (snap?.context && typeof snap.context === "object") {
        context = { ...snap.context };
      }
    } else if (event.type === "@context.updated") {
      const patch = event.patch as Record<string, unknown>;
      if (patch && typeof patch === "object") {
        context = { ...context, ...patch };
      }
    }
  }

  return context;
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

function Section({
  label,
  children,
  grow,
}: {
  label: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderBottom: "1px solid var(--dt-border)",
        ...(grow ? { flex: 1 } : {}),
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--dt-text-dim)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Fields({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: "var(--dt-text-dim)", fontWeight: 500 }}>{children}</div>
  );
}

function Field({
  label,
  value,
  mono,
  block,
  dim,
  color,
}: {
  label: string;
  value: string;
  mono?: boolean;
  block?: boolean;
  dim?: boolean;
  color?: string;
}) {
  const valueStyle: React.CSSProperties = {
    fontFamily: mono ? "monospace" : "inherit",
    color: color ?? (dim ? "var(--dt-text-dim)" : "var(--dt-text)"),
    fontSize: 11,
    whiteSpace: block ? "pre-wrap" : undefined,
    wordBreak: block ? "break-all" : undefined,
    marginTop: block ? 2 : 0,
  };

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}

function StateChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: 3,
        fontSize: 11,
        background: "rgba(137,180,250,0.12)",
        color: "var(--dt-accent)",
        marginRight: 4,
        marginBottom: 4,
        fontFamily: "monospace",
      }}
    >
      {children}
    </span>
  );
}

function Dim({ text, children }: { text?: string; children?: React.ReactNode }) {
  return <span style={{ color: "var(--dt-text-dim)", fontSize: 11 }}>{text ?? children}</span>;
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "var(--dt-text-dim)",
        fontSize: 11,
      }}
    >
      {text}
    </div>
  );
}
