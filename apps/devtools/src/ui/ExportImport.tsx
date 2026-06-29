import { useRef } from "react";

interface ExportImportProps {
  selectedActorId: string | null;
  onExport: (actorId: string) => void;
  onImport: (file: File) => void;
}

export function ExportImport({ selectedActorId, onExport, onImport }: ExportImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 10px" }}>
      <ActionButton
        onClick={() => {
          if (selectedActorId) onExport(selectedActorId);
        }}
        disabled={!selectedActorId}
        label="Export Trace"
      />
      <ActionButton onClick={() => inputRef.current?.click()} label="Import Trace" />
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImport(file);
          // Reset input so the same file can be re-imported
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ActionButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "var(--dt-surface2)",
        border: "1px solid var(--dt-border)",
        borderRadius: 4,
        color: disabled ? "var(--dt-text-dim)" : "var(--dt-text)",
        padding: "5px 8px",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        fontSize: 11,
        textAlign: "left",
      }}
    >
      {label}
    </button>
  );
}
