import type {
  TransportAbortIntent,
  TransportChannelLimits,
  TransportChannelPort,
  TransportDiagnostic,
  TransportListenerTerminal,
} from "../index.js";

export interface TransportConformancePair {
  readonly left: TransportChannelPort;
  readonly right: TransportChannelPort;
  close(): Promise<void>;
}

export interface TransportConformanceHarness {
  acquirePair(
    limits: TransportChannelLimits,
  ): Promise<TransportConformancePair>;
}

export interface TransportConformanceContext {
  readonly limits: TransportChannelLimits;
  readonly abortIntent: TransportAbortIntent;
}

export interface TransportConformanceCase {
  readonly id: string;
  readonly invariants: readonly string[];
  readonly obligations: readonly number[];
  readonly description: string;
}

export class TransportConformanceViolation extends Error {
  readonly caseId: string;

  constructor(caseId: string, message: string) {
    super(message);
    this.name = "TransportConformanceViolation";
    this.caseId = caseId;
  }
}

export type AcceptanceCallbackFaultKind =
  | "accept"
  | "pending-acquisition"
  | "active-channel";

export interface AcceptanceCallbackFaultObservation {
  readonly callbackEscaped: boolean;
  readonly triggeringAuthorityReleasedBeforeDiagnostic: boolean;
  readonly laterCallbackCount: number;
  readonly transferredChannelSurvived: boolean;
  readonly terminal: TransportListenerTerminal;
  readonly diagnostic?: TransportDiagnostic;
  readonly diagnosticCause?: unknown;
}

export interface AcceptanceCallbackFaultHarness {
  exerciseCallbackFault(input: {
    readonly kind: AcceptanceCallbackFaultKind;
    readonly thrown: unknown;
  }): Promise<AcceptanceCallbackFaultObservation>;
}
