import { TraversionGraph } from "./TraversionGraph.js";
import type { GraphHandler, GraphNode } from "./FormatHandler.js";
import type {
  GraphPathNode,
  GraphRequest,
  GraphResponse,
} from "./TraversionGraphWorkerClient.js";

const graph = new TraversionGraph();
let handlers: GraphHandler[] = [];
let paths: AsyncGenerator<GraphNode[]> | undefined;

function toNode(node: GraphPathNode): GraphNode {
  const handler = handlers.find((handler) => handler.name === node.handler);
  if (!handler) throw new Error(`Unknown graph handler: ${node.handler}`);
  return { handler, format: node.format };
}

function fromNode(node: GraphNode): GraphPathNode {
  return { handler: node.handler.name, format: node.format };
}

/** Advance the current search by one path, or `undefined` when exhausted. */
async function nextPath(): Promise<GraphPathNode[] | undefined> {
  const result = await paths?.next();
  if (!result || result.done) return undefined;
  return result.value.map(fromNode);
}

async function handle(
  request: GraphRequest,
): Promise<GraphPathNode[] | undefined> {
  switch (request.type) {
    case "init":
      handlers = request.handlers;
      graph.init(request.formats, handlers, request.strictCategories);
      return;
    case "search":
      graph.clearDeadEndPaths();
      paths = graph.searchPath(
        toNode(request.from),
        toNode(request.to),
        request.simpleMode,
      );
      return nextPath();
    case "next":
      // The client only asks for the next path after trying the previous one,
      // so any dead ends it reported in between are already applied.
      return nextPath();
    case "return":
      await paths?.return(undefined);
      paths = undefined;
      return;
    case "deadEnd":
      graph.addDeadEndPath(request.path.map(toNode));
      return;
  }
}

self.onmessage = async (event: MessageEvent<GraphRequest & { id: number }>) => {
  const { id } = event.data;
  let response: GraphResponse;
  try {
    response = { id, type: "result", path: await handle(event.data) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    response = { id, type: "error", error: message };
  }
  self.postMessage(response);
};
