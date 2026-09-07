interface SevenZipFileSystem {
  chdir(path: string): void;
  mkdir(path: string): unknown;
  readFile(path: string): Uint8Array;
  readdir(path: string): string[];
  stat(path: string): { mode: number };
  unlink(path: string): void;
  writeFile(path: string, data: string | ArrayBufferView): void;
  isDir(mode: number): boolean;
}

interface SevenZipModule {
  FS: SevenZipFileSystem;
  callMain(args: string[]): void;
}

interface SevenZipOptions {
  locateFile(url: string, scriptDirectory: string): string;
  stdout(charCode: number): void;
  stderr?(charCode: number): void;
}

export default function SevenZip(
  options?: Partial<SevenZipOptions>,
): Promise<SevenZipModule>;
