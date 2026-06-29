import { useEffect, useRef } from "react";
import type { InspectTraceEvent } from "@stategraph/inspect";

const EVENT_COLORS: Record<string, string> = {
  "@actor.started": "var(--dt-green)",
  "@actor.stopped": "var(--dt-text-dim)",
  "@event.received": "var(--dt-accent)",
  "@transition.fired": "var(--dt-purple)",
  "@action.executed": "var(--dt-teal)",
  "@effect.started": "var(--dt-yellow)",
  "@effect.done": "var(--dt-green)",
  "@effect.error": "var(--dt-red)",
  "@effect.cancelled": "var(--dt-orange)",
  "@context.updated": "var(--dt-teal)",
  "@error": "var(--dt-red)",
};

const EVENT_LABELS: Record<string, string> = {
  "@actor.started": "actor.started",
  "@actor.stopped": "actor.stopped",
  "@event.received": "event.received",
  "@transition.fired": "transition.fired",
  "@action.executed": "action.executed",
  "@effect.started": "effect.started",
  "@effect.done": "effect.done",
  "@effect.error": "effect.error",
  "@effect.cancelled": "effect.cancelled",
  "@context.updated": "context.updated",
  "@error": "error",
};

function eventSummary(event: InspectTraceEvent): string {
  switch (event.type) {
    case "@event.received":
      return (event.event as { type: string }).type;
    case "@transition.fired":
      return `${shortId(event.source)} → ${event.target ? shortId(event.target) : "(self)"}`;
    case "@action.executed":
      return event.actionType;
    case "@effect.started":
      return `${event.src} [${event.effectId}]`;
    case "@effect.done":
      return event.effectId;
    case "@effect.error":
      return event.effectId;
    case "@effect.cancelled":
      return event.effectId;
    case "@context.updated":
      return Object.keys(event.patch as object).join(", ");
    default:
      return "";
  }
}

function shortId(id: string): string {
  const parts = id.split(".");
  return parts[parts.length - 1] ?? id;
}

function formatTs(ts: number): string {
  if (ts < 1000) return `${ts}ms`;
  return `${(ts / 1000).toFixed(2)}s`;
}

interface EventLogProps {
  events: InspectTraceEvent[];
  selectedSeq: number | null;
  onSelect: (seq: number) => void;
}

export function EventLog({ events, selectedSeq, onSelect }: EventLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  if (events.length === 0) {
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
        No events
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr
            style={{
              position: "sticky",
              top: 0,
              background: "var(--dt-surface)",
              zIndex: 1,
            }}
          >
            <Th width={40}>seq</Th>
            <Th width={52}>time</Th>
            <Th width={130}>type</Th>
            <Th>detail</Th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const isSelected = event.seq === selectedSeq;
            const color = EVENT_COLORS[event.type] ?? "var(--dt-text-dim)";
            return (
              <tr
                key={event.seq}
                onClick={() => onSelect(event.seq)}
                style={{
                  background: isSelected ? "var(--dt-surface2)" : "transparent",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--dt-border)",
                }}
              >
                <Td style={{ color: "var(--dt-text-dim)", textAlign: "right" }}>{event.seq}</Td>
                <Td style={{ color: "var(--dt-text-dim)" }}>{formatTs(event.ts)}</Td>
                <Td style={{ color }}>{EVENT_LABELS[event.type] ?? event.type}</Td>
                <Td
                  style={{
                    color: "var(--dt-text-dim)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 200,
                  }}
                >
                  {eventSummary(event)}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div ref={bottomRef} />
    </div>
  );
}

function Th({
  children,
  width,
  style,
}: {
  children: React.ReactNode;
  width?: number;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        padding: "4px 8px",
        textAlign: "left",
        color: "var(--dt-text-dim)",
        fontWeight: 400,
        fontSize: 10,
        borderBottom: "1px solid var(--dt-border)",
        width,
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "4px 8px", fontSize: 11, ...style }}>{children}</td>;
}
