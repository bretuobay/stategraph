import { useEffect, useRef, useState } from "react";
import { deserializeEnvelope, isBridgeMessage, serializeEnvelope } from "@stategraph/inspect";
import { useActor } from "@stategraph/react";
import { devtoolsMachine } from "../machine";
import type { SessionData } from "../machine";
import { DEMO_TRACE } from "../channel/demoTrace";

export type ConnectionMode = "none" | "live" | "demo";

export interface DevtoolsHook {
  machineState: "idle" | "listening" | "active";
  mode: ConnectionMode;
  sessions: Record<string, SessionData>;
  selectedActorId: string | null;
  setSelectedActorId: (id: string | null) => void;
  selectedSeq: number | null;
  setSelectedSeq: (seq: number | null) => void;
  loadDemo: () => void;
  connectLive: () => void;
  clearAll: () => void;
  exportSession: (actorId: string) => void;
  importFile: (file: File) => void;
}

export function useDevtools(): DevtoolsHook {
  const { snapshot, send } = useActor(devtoolsMachine);
  const [selectedActorId, setSelectedActorIdRaw] = useState<string | null>(null);
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [mode, setMode] = useState<ConnectionMode>("none");

  const machineState = snapshot.value as "idle" | "listening" | "active";
  const sessions = snapshot.context.sessions;

  // Keep mode in sync with machine state
  const prevMachineState = useRef(machineState);
  useEffect(() => {
    if (prevMachineState.current !== machineState) {
      prevMachineState.current = machineState;
      if (machineState === "idle") setMode("none");
    }
  }, [machineState]);

  // Subscribe to postMessage in live mode
  useEffect(() => {
    if (mode !== "live") return;

    function handleMessage(ev: MessageEvent): void {
      const data: unknown = ev.data;
      if (!isBridgeMessage(data)) return;
      if (data.kind === "trace:event") {
        send({
          type: "TRACE_RECEIVED",
          machineId: data.machineId,
          sessionId: data.sessionId,
          actorId: data.actorId,
          event: data.event,
        });
      } else if (data.kind === "trace:snapshot") {
        send({
          type: "IMPORT",
          envelope: {
            schemaVersion: data.schemaVersion,
            sessionId: data.sessionId,
            machineId: data.machineId,
            actorId: data.actorId,
            createdAt: data.createdAt,
            events: data.events,
          },
        });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [mode, send]);

  // Auto-select first actor when sessions first appear
  useEffect(() => {
    if (selectedActorId !== null) return;
    const firstId = Object.keys(sessions)[0];
    if (firstId) setSelectedActorIdRaw(firstId);
  }, [sessions, selectedActorId]);

  function setSelectedActorId(id: string | null): void {
    setSelectedActorIdRaw(id);
    setSelectedSeq(null);
  }

  return {
    machineState,
    mode,
    sessions,
    selectedActorId,
    setSelectedActorId,
    selectedSeq,
    setSelectedSeq,

    loadDemo() {
      setMode("demo");
      send({ type: "IMPORT", envelope: DEMO_TRACE });
    },

    connectLive() {
      setMode("live");
      send({ type: "CONNECT_LIVE" });
    },

    clearAll() {
      send({ type: "CLEAR" });
      setSelectedActorId(null);
      setMode("none");
    },

    exportSession(actorId) {
      const session = sessions[actorId];
      if (!session) return;
      const json = serializeEnvelope({
        schemaVersion: "1.0",
        sessionId: session.sessionId,
        machineId: session.machineId,
        actorId: session.actorId,
        createdAt: session.createdAt,
        events: session.events,
      });
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${session.machineId}-trace.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    importFile(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text !== "string") return;
        try {
          const envelope = deserializeEnvelope(text);
          send({ type: "IMPORT", envelope });
        } catch {
          // Invalid trace file — ignore silently
        }
      };
      reader.readAsText(file);
    },
  };
}
