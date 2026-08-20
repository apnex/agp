import type {
  TransportAbortIntent,
  TransportChannelPort,
  TransportRead,
  TransportTerminal,
} from "../index.js";
import { TransportConformanceViolation } from "./harness.js";

export interface TerminalOnceCaseResult {
  readonly id: "terminal-once";
  readonly terminal: TransportTerminal;
}

export async function runTerminalOnceCase(
  channel: TransportChannelPort,
  intent: TransportAbortIntent,
): Promise<TerminalOnceCaseResult> {
  channel.abort(intent);
  channel.abort(intent);
  const first = terminalFrom(
    await channel.read(liveSignal()),
    "first",
  );
  const second = terminalFrom(
    await channel.read(liveSignal()),
    "second",
  );
  if (first !== second && JSON.stringify(first) !== JSON.stringify(second)) {
    throw new TransportConformanceViolation(
      "terminal-once",
      "post-terminal reads did not return one stable terminal",
    );
  }
  return Object.freeze({ id: "terminal-once", terminal: first });
}

function terminalFrom(
  result: TransportRead,
  position: string,
): TransportTerminal {
  if (result.kind !== "terminal") {
    throw new TransportConformanceViolation(
      "terminal-once",
      `${position} read returned ${result.kind}`,
    );
  }
  return result.terminal;
}

function liveSignal(): AbortSignal {
  return new AbortController().signal;
}
