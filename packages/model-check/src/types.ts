import type { MachineIR } from "@stategraph/core";

export type ModelCheckInput = MachineIR | { toIR(): MachineIR };

export interface ModelCheckConfig {
  checks: {
    unreachableStates: boolean;
    deadStates: boolean;
    deadTransitions: boolean;
    invalidTargets: boolean;
    nondeterminism: boolean;
    missingInitial: boolean;
    effectsWithoutCancel: boolean;
  };
  bounded?: {
    enabled: boolean;
    maxPathDepth: number;
    maxStatesExplored: number;
    maxTransitions: number;
    maxCycleLength: number;
    timeoutMs: number;
  };
}

export interface ModelCheckDiagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  stateId?: string;
  transitionSource?: string;
  transitionEvent?: string;
}

export interface ModelCheckResult {
  passed: boolean;
  diagnostics: ModelCheckDiagnostic[];
  stats: {
    statesAnalyzed: number;
    transitionsAnalyzed: number;
    durationMs: number;
    bounded: boolean;
    hitLimit: boolean;
  };
}
