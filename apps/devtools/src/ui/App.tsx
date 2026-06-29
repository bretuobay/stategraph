import { Playground } from "./Playground";

export function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header
        style={{
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          background: "var(--dt-surface)",
          borderBottom: "1px solid var(--dt-border)",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--dt-accent)", fontSize: 12 }}>
          ◆ StateGraph DevTools
        </span>
      </header>
      <Playground />
    </div>
  );
}
