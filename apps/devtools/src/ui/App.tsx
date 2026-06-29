import { useDevtools } from "../hooks/useDevtools";
import type { ConnectionMode } from "../hooks/useDevtools";
import { ActorList } from "./ActorList";
import { EventLog } from "./EventLog";
import { DetailPanel } from "./DetailPanel";
import { ExportImport } from "./ExportImport";

export function App() {
  const dt = useDevtools();
  const selectedSession = dt.selectedActorId ? (dt.sessions[dt.selectedActorId] ?? null) : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "36px 1fr",
        gridTemplateColumns: "220px 1fr 280px",
        height: "100%",
      }}
    >
      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <header
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
          background: "var(--dt-surface)",
          borderBottom: "1px solid var(--dt-border)",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--dt-accent)", fontSize: 12 }}>
          ◆ StateGraph DevTools
        </span>
        <ConnectionBadge mode={dt.mode} machineState={dt.machineState} />
        <div style={{ flex: 1 }} />
        {dt.mode === "none" && (
          <>
            <ToolbarBtn onClick={dt.loadDemo}>Load Demo</ToolbarBtn>
            <ToolbarBtn onClick={dt.connectLive} accent>
              Connect Live
            </ToolbarBtn>
          </>
        )}
        {dt.mode !== "none" && <ToolbarBtn onClick={dt.clearAll}>Clear</ToolbarBtn>}
      </header>

      {/* ── Left sidebar ──────────────────────────────────────────── */}
      <aside
        style={{
          gridRow: 2,
          gridColumn: 1,
          display: "flex",
          flexDirection: "column",
          background: "var(--dt-surface)",
          borderRight: "1px solid var(--dt-border)",
          overflowY: "auto",
        }}
      >
        <SidebarSection label="Actors">
          <ActorList
            sessions={dt.sessions}
            selectedActorId={dt.selectedActorId}
            onSelect={dt.setSelectedActorId}
          />
        </SidebarSection>
        <div style={{ flex: 1 }} />
        <div style={{ borderTop: "1px solid var(--dt-border)" }}>
          <ExportImport
            selectedActorId={dt.selectedActorId}
            onExport={dt.exportSession}
            onImport={dt.importFile}
          />
        </div>
      </aside>

      {/* ── Event log ─────────────────────────────────────────────── */}
      <main
        style={{
          gridRow: 2,
          gridColumn: 2,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {selectedSession ? (
          <EventLog
            events={selectedSession.events}
            selectedSeq={dt.selectedSeq}
            onSelect={dt.setSelectedSeq}
          />
        ) : (
          <IdleState mode={dt.mode} onLoadDemo={dt.loadDemo} onConnectLive={dt.connectLive} />
        )}
      </main>

      {/* ── Detail panel ──────────────────────────────────────────── */}
      <aside
        style={{
          gridRow: 2,
          gridColumn: 3,
          borderLeft: "1px solid var(--dt-border)",
          overflow: "hidden",
        }}
      >
        <DetailPanel session={selectedSession} selectedSeq={dt.selectedSeq} />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConnectionBadge({ mode, machineState }: { mode: ConnectionMode; machineState: string }) {
  const label =
    machineState === "listening"
      ? "Listening…"
      : mode === "live"
        ? "Live"
        : mode === "demo"
          ? "Demo"
          : null;

  if (!label) return null;

  const color =
    machineState === "listening"
      ? "var(--dt-yellow)"
      : mode === "live"
        ? "var(--dt-green)"
        : "var(--dt-text-dim)";

  return (
    <span
      style={{
        padding: "1px 6px",
        borderRadius: 3,
        fontSize: 10,
        background: "var(--dt-surface2)",
        color,
        border: `1px solid ${color}`,
      }}
    >
      {label}
    </span>
  );
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          padding: "6px 10px 4px",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--dt-text-dim)",
          borderBottom: "1px solid var(--dt-border)",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ToolbarBtn({
  onClick,
  children,
  accent,
}: {
  onClick: () => void;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: accent ? "rgba(137,180,250,0.15)" : "var(--dt-surface2)",
        border: `1px solid ${accent ? "var(--dt-accent)" : "var(--dt-border)"}`,
        borderRadius: 4,
        color: accent ? "var(--dt-accent)" : "var(--dt-text)",
        padding: "3px 10px",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 11,
      }}
    >
      {children}
    </button>
  );
}

function IdleState({
  mode,
  onLoadDemo,
  onConnectLive,
}: {
  mode: ConnectionMode;
  onLoadDemo: () => void;
  onConnectLive: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 16,
        color: "var(--dt-text-dim)",
        padding: 24,
        textAlign: "center",
      }}
    >
      {mode === "none" ? (
        <>
          <div style={{ fontSize: 13, color: "var(--dt-text)" }}>No session connected</div>
          <div style={{ fontSize: 11, lineHeight: 1.6, maxWidth: 340 }}>
            Load the demo trace to explore the devtools, or connect your app by calling{" "}
            <code
              style={{
                background: "var(--dt-surface2)",
                padding: "1px 4px",
                borderRadius: 3,
                color: "var(--dt-accent)",
              }}
            >
              createDevtoolsBridge
            </code>{" "}
            with a postMessage channel.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <ToolbarBtn onClick={onLoadDemo}>Load Demo</ToolbarBtn>
            <ToolbarBtn onClick={onConnectLive} accent>
              Connect Live
            </ToolbarBtn>
          </div>
        </>
      ) : mode === "live" ? (
        <div style={{ fontSize: 11, lineHeight: 1.8 }}>
          <div style={{ color: "var(--dt-yellow)", marginBottom: 8 }}>
            Listening for trace events…
          </div>
          <div>In your app, call:</div>
          <pre
            style={{
              marginTop: 8,
              padding: "8px 12px",
              background: "var(--dt-surface)",
              border: "1px solid var(--dt-border)",
              borderRadius: 4,
              color: "var(--dt-text)",
              textAlign: "left",
              fontSize: 10,
              lineHeight: 1.6,
            }}
          >
            {`import { createDevtoolsBridge } from "@stategraph/inspect";

createDevtoolsBridge(actor, {
  machineId: machine.id,
  channel: {
    postMessage: (msg) =>
      window.postMessage(msg, "*"),
  },
});`}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
