import {
  createNode,
  type AgpNode,
  type EndpointName,
  type MessageId,
  type NodeConfig,
} from "@agp/node";
import type { MessageDisposition } from "@agp/core";

// Compile-only fixture: resolve package exports, not the implementation class.
declare const config: NodeConfig;
declare const messageId: MessageId;
declare const source: EndpointName;

const factoryNode = createNode(config);
const node: AgpNode = factoryNode;
factoryNode.disposition(messageId);
factoryNode.settled(messageId);
factoryNode.dispositions().close();

const current: MessageDisposition | undefined = node.disposition(messageId);
const terminal: MessageDisposition | undefined = await node.settled(messageId);
void [current, terminal];

const stream = node.dispositions({ source });
for await (const report of stream) {
  const disposition: MessageDisposition = report;
  void disposition;
  break;
}
const closed: void = stream.close();
void closed;
node.dispositions().close();
node.dispositions({}).close();
node.dispositions(undefined).close();

// Exact signatures reject loss of undefined, async iteration, close, or type safety.
type SameType<Actual, Expected> =
  (<T>() => T extends Actual ? 1 : 2) extends
  (<T>() => T extends Expected ? 1 : 2) ? true : false;
type RequireTrue<T extends true> = T;
type FactoryNodeContract = RequireTrue<SameType<typeof factoryNode, AgpNode>>;
type DispositionContract = RequireTrue<SameType<
  AgpNode["disposition"],
  (messageId: MessageId) => MessageDisposition | undefined
>>;
type SettledContract = RequireTrue<SameType<
  AgpNode["settled"],
  (messageId: MessageId) => Promise<MessageDisposition | undefined>
>>;
type DispositionsContract = RequireTrue<SameType<
  AgpNode["dispositions"],
  (options?: { readonly source?: EndpointName }) =>
    AsyncIterable<MessageDisposition> & { close(): void }
>>;

// @ts-expect-error A disposition lookup requires a message ID.
node.disposition();
// @ts-expect-error Message IDs are not numbers.
node.disposition(42);
// @ts-expect-error Settlement requires a message ID.
node.settled();
// @ts-expect-error Message IDs are not numbers.
node.settled(42);
// @ts-expect-error A source endpoint name is not a number.
node.dispositions({ source: 42 });
// @ts-expect-error Only source endpoint filtering is supported.
node.dispositions({ destination: source });
// @ts-expect-error A disposition stream is asynchronously iterable, not synchronous.
for (const report of stream) void report;
