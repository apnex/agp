export function parsePort(value, fallback, optionName) {
  const text = value ?? String(fallback);
  if (!/^(?:0|[1-9][0-9]{0,4})$/.test(text)) {
    throw new Error(`${optionName} must be an integer from 0 to 65535`);
  }
  const port = Number(text);
  if (port > 65_535) {
    throw new Error(`${optionName} must be an integer from 0 to 65535`);
  }
  return port;
}

export function parseBindHost(value, fallback, optionName) {
  const host = value ?? fallback;
  if (
    typeof host !== "string" ||
    host.length === 0 ||
    host.length > 253 ||
    /[/?#@\s]/.test(host)
  ) {
    throw new Error(`${optionName} must be a literal bind host or address`);
  }
  return host;
}

export function parseHubUrl(value, fallback, optionName = "--hub-url") {
  const text = value ?? fallback;
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${optionName} must be a valid ws:// URL`);
  }
  if (
    url.protocol !== "ws:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    url.search !== "" ||
    url.pathname !== "/agp"
  ) {
    throw new Error(
      `${optionName} must use ws://HOST:PORT/agp without credentials, query, or fragment`,
    );
  }
  return url.toString();
}

export function waitForShutdownSignal() {
  return new Promise((resolve) => {
    const finish = (signal) => {
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onTerminate);
      resolve(signal);
    };
    const onInterrupt = () => finish("SIGINT");
    const onTerminate = () => finish("SIGTERM");
    process.once("SIGINT", onInterrupt);
    process.once("SIGTERM", onTerminate);
  });
}

export function safeMessage(error) {
  if (!(error instanceof Error)) return "unknown error";
  const messages = [];
  const seen = new Set();
  let current = error;
  while (current instanceof Error && messages.length < 4 && !seen.has(current)) {
    seen.add(current);
    messages.push(current.message);
    current = current.cause;
  }
  return messages.join(": ");
}
