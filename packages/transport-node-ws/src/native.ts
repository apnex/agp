import type { Duplex } from "node:stream";
import type { RawData } from "ws";

export function rawDataSnapshot(data: RawData): Uint8Array {
  if (Buffer.isBuffer(data)) return Uint8Array.from(data);
  if (data instanceof ArrayBuffer) {
    return Uint8Array.from(new Uint8Array(data));
  }
  if (Array.isArray(data)) {
    return Uint8Array.from(Buffer.concat(data));
  }
  return Uint8Array.from(data);
}

export function rejectUpgrade(
  socket: Duplex,
  status: 400 | 404 | 503,
): void {
  const label =
    status === 400 ? "Bad Request"
    : status === 404 ? "Not Found"
    : "Service Unavailable";
  try {
    socket.end(
      `HTTP/1.1 ${status} ${label}\r\n`
      + "Connection: close\r\n"
      + "Content-Length: 0\r\n"
      + "Cache-Control: no-store\r\n\r\n",
    );
  } catch {
    socket.destroy();
  }
}
