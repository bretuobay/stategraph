import type { SessionData } from "../machine";

interface ActorListProps {
  sessions: Record<string, SessionData>;
  selectedActorId: string | null;
  onSelect: (actorId: string) => void;
}

export function ActorList({ sessions, selectedActorId, onSelect }: ActorListProps) {
  const entries = Object.values(sessions);

  if (entries.length === 0) {
    return (
      <div style={{ padding: "12px", color: "var(--dt-text-dim)", fontSize: 11 }}>No actors</div>
    );
  }

  return (
    <div>
      {entries.map((session) => {
        const isSelected = session.actorId === selectedActorId;
        return (
          <button
            key={session.actorId}
            onClick={() => onSelect(session.actorId)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: isSelected ? "var(--dt-surface2)" : "transparent",
              border: "none",
              borderLeft: `2px solid ${isSelected ? "var(--dt-accent)" : "transparent"}`,
              padding: "8px 10px",
              cursor: "pointer",
              color: "var(--dt-text)",
              fontFamily: "inherit",
              fontSize: 11,
            }}
          >
            <div
              style={{ fontWeight: 600, color: isSelected ? "var(--dt-accent)" : "var(--dt-text)" }}
            >
              {session.machineId}
            </div>
            <div style={{ color: "var(--dt-text-dim)", marginTop: 2, fontSize: 10 }}>
              {session.actorId}
            </div>
            <div style={{ marginTop: 4 }}>
              <StatusBadge status={session.status} />
              <span style={{ color: "var(--dt-text-dim)", marginLeft: 6, fontSize: 10 }}>
                {session.events.length} events
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "stopped" }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 5px",
        borderRadius: 3,
        fontSize: 10,
        background: status === "active" ? "rgba(166,227,161,0.15)" : "rgba(108,112,134,0.15)",
        color: status === "active" ? "var(--dt-green)" : "var(--dt-text-dim)",
      }}
    >
      {status}
    </span>
  );
}
