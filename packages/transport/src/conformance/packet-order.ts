import type {
  TransportChannelLimits,
  TransportRead,
} from "../index.js";
import type { TransportConformanceHarness } from "./harness.js";
import { TransportConformanceViolation } from "./harness.js";

export interface PacketOrderCaseResult {
  readonly id: "packet-order";
  readonly leftToRight: readonly (readonly number[])[];
  readonly rightToLeft: readonly (readonly number[])[];
}

export async function runPacketOrderCase(
  harness: TransportConformanceHarness,
  limits: TransportChannelLimits,
): Promise<PacketOrderCaseResult> {
  const pair = await harness.acquirePair(limits);
  try {
    const leftPackets = [
      new Uint8Array([]),
      new Uint8Array([0, 1, 2, 255]),
      new Uint8Array([9, 8, 7]),
    ];
    const rightPackets = [
      new Uint8Array([255, 0, 128]),
      new Uint8Array([4]),
    ];

    for (const bytes of leftPackets) {
      await pair.left.send({ bytes }, liveSignal());
    }
    for (const bytes of rightPackets) {
      await pair.right.send({ bytes }, liveSignal());
    }

    const leftToRight = await readPackets(
      "packet-order",
      pair.right,
      leftPackets.length,
    );
    const rightToLeft = await readPackets(
      "packet-order",
      pair.left,
      rightPackets.length,
    );
    assertSequences("packet-order", leftPackets, leftToRight);
    assertSequences("packet-order", rightPackets, rightToLeft);
    return Object.freeze({
      id: "packet-order",
      leftToRight: freezeSequences(leftToRight),
      rightToLeft: freezeSequences(rightToLeft),
    });
  } finally {
    await pair.close();
  }
}

async function readPackets(
  caseId: string,
  channel: {
    read(signal: AbortSignal): Promise<TransportRead>;
  },
  count: number,
): Promise<number[][]> {
  const packets: number[][] = [];
  for (let index = 0; index < count; index += 1) {
    const result = await channel.read(liveSignal());
    if (result.kind !== "packet") {
      throw new TransportConformanceViolation(
        caseId,
        `expected packet ${index}, received ${result.kind}`,
      );
    }
    packets.push([...result.packet.bytes]);
  }
  return packets;
}

function assertSequences(
  caseId: string,
  expected: readonly Uint8Array[],
  actual: readonly (readonly number[])[],
): void {
  const encodedExpected = JSON.stringify(expected.map((value) => [...value]));
  const encodedActual = JSON.stringify(actual);
  if (encodedActual !== encodedExpected) {
    throw new TransportConformanceViolation(
      caseId,
      `packet sequence mismatch: ${encodedActual}`,
    );
  }
}

function freezeSequences(
  values: readonly (readonly number[])[],
): readonly (readonly number[])[] {
  return Object.freeze(
    values.map((value) => Object.freeze([...value])),
  );
}

function liveSignal(): AbortSignal {
  return new AbortController().signal;
}
