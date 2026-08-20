import type {
  TransportDiagnostic,
  TransportDiagnosticSinkPort,
} from "./types.js";

export function emitTransportDiagnostic(
  sink: TransportDiagnosticSinkPort | undefined,
  diagnostic: TransportDiagnostic,
  cause?: unknown,
): void {
  if (sink === undefined) return;
  try {
    sink.emit(diagnostic, cause);
  } catch {
    // Observation is deliberately inert.
  }
}
