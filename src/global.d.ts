import type { FileFormat, FileData, ConvertPathNode } from "./FormatHandler.js";
import type { TraversionGraphWorkerClient } from "./TraversionGraphWorkerClient.js";

declare global {
  interface Window {
    supportedFormatCache: Map<string, FileFormat[]>;
    traversionGraph: TraversionGraphWorkerClient;
    printSupportedFormatCache: () => string;
    showPopup: (html: string) => void;
    hidePopup: () => void;
    tryConvertByTraversing: (
      files: FileData[],
      from: ConvertPathNode,
      to: ConvertPathNode,
      signal?: AbortSignal,
    ) => Promise<{
      files: FileData[];
      path: ConvertPathNode[];
    } | null>;
  }
}

export {};
