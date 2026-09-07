import {
  cloneFormat,
  type ConvertPathNode,
  type FileFormat,
  type FormatHandler,
  type GraphHandler,
} from "./FormatHandler.js";

/** A path node that can be sent across the worker boundary. */
export type GraphPathNode = { handler: string; format: FileFormat };
export type GraphRequest =
  | {
      type: "init";
      formats: Map<string, FileFormat[]>;
      handlers: GraphHandler[];
      strictCategories: boolean;
    }
  | {
      type: "search";
      from: GraphPathNode;
      to: GraphPathNode;
      simpleMode: boolean;
    }
  | { type: "next" }
  | { type: "return" }
  | { type: "deadEnd"; path: GraphPathNode[] };
export type GraphResponse = { id: number } & (
  { type: "result"; path?: GraphPathNode[] } | { type: "error"; error: string }
);

type PendingRequest = {
  resolve: (response: GraphResponse) => void;
  reject: (error: unknown) => void;
};

const cancelled = () => new DOMException("Path search cancelled", "AbortError");

const fromNode = (node: ConvertPathNode): GraphPathNode => ({
  handler: node.handler.name,
  format: cloneFormat(node.format),
});

/**
 * Runs the (CPU heavy) `TraversionGraph` inside a web worker.
 * The worker is created lazily and recreated after being disposed.
 */
export class TraversionGraphWorkerClient {
  private worker?: Worker;
  private config?: Extract<GraphRequest, { type: "init" }>;
  private handlers: FormatHandler[] = [];
  /** Resolves once the current worker has processed the init request. */
  private initialized?: Promise<unknown>;
  private nextId = 0;
  private searching = false;
  private pending = new Map<number, PendingRequest>();

  public async init(
    formats: Map<string, FileFormat[]>,
    handlers: FormatHandler[],
    strictCategories = false,
  ) {
    this.dispose();
    this.handlers = handlers;
    this.config = {
      type: "init",
      formats: new Map(
        [...formats].map(([name, entries]) => [name, entries.map(cloneFormat)]),
      ),
      handlers: handlers.map((handler) => ({
        name: handler.name,
        supportAnyInput: handler.supportAnyInput,
        supportedFormats: handler.supportedFormats?.map(cloneFormat),
      })),
      strictCategories,
    };
    this.getWorker();
    await this.initialized;
  }

  /** Terminates the worker and rejects every in-flight request. */
  public dispose(error: unknown = cancelled()) {
    this.worker?.terminate();
    this.worker = undefined;
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }

  public async addDeadEndPath(path: ConvertPathNode[]) {
    await this.request({ type: "deadEnd", path: path.map(fromNode) });
  }

  public async *searchPath(
    from: ConvertPathNode,
    to: ConvertPathNode,
    simpleMode: boolean,
    signal?: AbortSignal,
  ): AsyncGenerator<ConvertPathNode[]> {
    signal?.throwIfAborted();
    if (this.searching) throw new Error("A path search is already running");
    this.searching = true;
    const onAbort = () => this.dispose();
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      let response = await this.request({
        type: "search",
        from: fromNode(from),
        to: fromNode(to),
        simpleMode,
      });
      while (response.type === "result" && response.path) {
        yield response.path.map((node) => this.toNode(node));
        signal?.throwIfAborted();
        response = await this.request({ type: "next" });
      }
    } finally {
      signal?.removeEventListener("abort", onAbort);
      // Let the worker close its generator, unless it was already disposed.
      if (this.worker) await this.request({ type: "return" }).catch(() => {});
      this.searching = false;
    }
  }

  private toNode(node: GraphPathNode): ConvertPathNode {
    const handler = this.handlers.find((h) => h.name === node.handler);
    if (!handler) throw new Error(`Unknown graph handler: ${node.handler}`);
    return { handler, format: node.format };
  }

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    if (!this.config) throw new Error("Traversion graph is not initialized");

    const worker = new Worker(
      new URL("./traversionGraph.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<GraphResponse>) => {
      const response = event.data;
      const request = this.pending.get(response.id);
      this.pending.delete(response.id);
      if (response.type === "error") request?.reject(new Error(response.error));
      else request?.resolve(response);
    };
    worker.onerror = (event) =>
      this.dispose(
        new Error(event.message || "Traversion graph worker failed"),
      );
    worker.onmessageerror = () =>
      this.dispose(new Error("Invalid traversion graph worker message"));

    this.worker = worker;
    // The worker handles messages in order, so every later request
    // implicitly waits for this init request to finish.
    this.initialized = this.request(this.config);
    this.initialized.catch(() => {}); // surfaced through the failing requests
    return worker;
  }

  private request(request: GraphRequest): Promise<GraphResponse> {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      try {
        this.getWorker().postMessage({ ...request, id });
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }
}
