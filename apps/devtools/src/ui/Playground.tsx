import { setup, assign } from "@stategraph/core";
import { useActor } from "@stategraph/react";
import { DevtoolsOverlay } from "@stategraph/react/devtools";

// ---------------------------------------------------------------------------
// Machines — defined at module level so identity is stable across re-renders
// ---------------------------------------------------------------------------

type CounterCtx = { count: number };
type CounterEvent = { type: "INC" } | { type: "DEC" } | { type: "RESET" };

const counterMachine = setup<CounterCtx, CounterEvent>({
  actions: {
    inc: assign(({ context }) => ({ count: context.count + 1 })),
    dec: assign(({ context }) => ({ count: context.count - 1 })),
    reset: assign(() => ({ count: 0 })),
  },
}).createMachine({
  id: "counter",
  initial: "active",
  context: { count: 0 },
  states: {
    active: {
      on: {
        INC: { actions: ["inc"] },
        DEC: { actions: ["dec"] },
        RESET: { actions: ["reset"] },
      },
    },
  },
});

type TrafficEvent = { type: "NEXT" };

const trafficMachine = setup<Record<never, never>, TrafficEvent>({}).createMachine({
  id: "trafficLight",
  initial: "red",
  context: {},
  states: {
    red: { on: { NEXT: { target: "green" } } },
    green: { on: { NEXT: { target: "yellow" } } },
    yellow: { on: { NEXT: { target: "red" } } },
  },
});

// ---------------------------------------------------------------------------
// Playground — demonstrates DevtoolsOverlay in a real app context
// ---------------------------------------------------------------------------

export function Playground() {
  return (
    // paddingBottom prevents content from hiding behind the fixed overlay
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px 32px 320px",
        display: "flex",
        flexDirection: "column",
        gap: 32,
      }}
    >
      <div>
        <h2
          style={{
            margin: "0 0 4px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--dt-text)",
          }}
        >
          Playground
        </h2>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 11,
            color: "var(--dt-text-dim)",
            lineHeight: 1.6,
          }}
        >
          Live demo of{" "}
          <code
            style={{
              background: "var(--dt-surface2)",
              padding: "1px 4px",
              borderRadius: 3,
              color: "var(--dt-accent)",
            }}
          >
            {"<DevtoolsOverlay />"}
          </code>{" "}
          from{" "}
          <code
            style={{
              background: "var(--dt-surface2)",
              padding: "1px 4px",
              borderRadius: 3,
              color: "var(--dt-accent)",
            }}
          >
            @stategraph/react/devtools
          </code>
          . Both machines below are discovered automatically via{" "}
          <code
            style={{
              background: "var(--dt-surface2)",
              padding: "1px 4px",
              borderRadius: 3,
              color: "var(--dt-accent)",
            }}
          >
            useActor
          </code>{" "}
          — no extra wiring needed. Interact with them and watch events appear in the panel at the
          bottom of this page.
        </p>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <CounterDemo />
          <TrafficLightDemo />
        </div>
      </div>

      <UsageSnippet />

      {/* The overlay auto-discovers both machines via useActorRef */}
      <DevtoolsOverlay />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Counter demo
// ---------------------------------------------------------------------------

function CounterDemo() {
  const { snapshot, send } = useActor(counterMachine);

  return (
    <Card title="Counter" machineId="counter">
      <div
        style={{
          fontSize: 40,
          fontWeight: 700,
          color: "var(--dt-accent)",
          textAlign: "center",
          padding: "12px 0",
          letterSpacing: "-1px",
        }}
      >
        {snapshot.context.count}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <DemoBtn onClick={() => send({ type: "DEC" })}>−</DemoBtn>
        <DemoBtn onClick={() => send({ type: "INC" })} accent>
          +
        </DemoBtn>
        <DemoBtn onClick={() => send({ type: "RESET" })}>reset</DemoBtn>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Traffic light demo
// ---------------------------------------------------------------------------

const LIGHT_COLORS: Record<string, string> = {
  red: "#f38ba8",
  yellow: "#f9e2af",
  green: "#a6e3a1",
};

const LIGHT_LABELS: Record<string, string> = {
  red: "Stop",
  yellow: "Caution",
  green: "Go",
};

function TrafficLightDemo() {
  const { snapshot, send } = useActor(trafficMachine);
  const state = String(snapshot.value);
  const color = LIGHT_COLORS[state] ?? "#cdd6f4";

  return (
    <Card title="Traffic Light" machineId="trafficLight">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          padding: "12px 0",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 20px ${color}80`,
            transition: "background 250ms, box-shadow 250ms",
          }}
        />
        <div style={{ fontSize: 12, color: "var(--dt-text-dim)" }}>
          {LIGHT_LABELS[state] ?? state}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <DemoBtn onClick={() => send({ type: "NEXT" })} accent>
          Next →
        </DemoBtn>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Usage snippet
// ---------------------------------------------------------------------------

function UsageSnippet() {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "var(--dt-text-dim)",
          marginBottom: 8,
        }}
      >
        How to add this to your app
      </div>
      <pre
        style={{
          margin: 0,
          padding: "12px 16px",
          background: "var(--dt-surface)",
          border: "1px solid var(--dt-border)",
          borderRadius: 6,
          fontSize: 11,
          lineHeight: 1.7,
          color: "var(--dt-text)",
          overflowX: "auto",
        }}
      >
        {`// 1. Import from the dedicated subpath (tree-shaken in production)
import { DevtoolsOverlay } from "@stategraph/react/devtools";

// 2. Mount once near your app root, guarded by a dev-only condition
export function App() {
  return (
    <>
      <YourRoutes />
      {import.meta.env.DEV && <DevtoolsOverlay />}
    </>
  );
}

// 3. That's it — every useActor / useActorRef call is auto-discovered.`}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function Card({
  title,
  machineId,
  children,
}: {
  title: string;
  machineId: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--dt-surface)",
        border: "1px solid var(--dt-border)",
        borderRadius: 8,
        padding: 16,
        minWidth: 200,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--dt-text)" }}>{title}</span>
        <span
          style={{
            fontSize: 9,
            padding: "1px 5px",
            borderRadius: 3,
            background: "var(--dt-surface2)",
            color: "var(--dt-text-dim)",
            border: "1px solid var(--dt-border)",
          }}
        >
          {machineId}
        </span>
      </div>
      {children}
    </div>
  );
}

function DemoBtn({
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
        padding: "5px 14px",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: accent ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}
