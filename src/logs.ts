import { createWriteStream, statSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import type { WriteStream } from "node:fs";

const MAX_LOG_SIZE = 1 * 1024 * 1024; // 1MB
const KEEP_SIZE = 512 * 1024; // Keep last 512KB when truncating

/**
 * Create a write stream that caps file size at 1MB
 */
export function createCappedWriteStream(path: string): WriteStream {
  const stream = createWriteStream(path, { flags: "a" });

  // Check and truncate periodically
  let bytesWritten = 0;
  const originalWrite = stream.write.bind(stream);

  stream.write = function (chunk: any, ...args: any[]): boolean {
    bytesWritten += Buffer.byteLength(chunk);

    // Every ~100KB written, check total size
    if (bytesWritten > 100 * 1024) {
      bytesWritten = 0;
      try {
        const stats = statSync(path);
        if (stats.size > MAX_LOG_SIZE) {
          // Truncate asynchronously - next writes will be to truncated file
          truncateLogFile(path);
        }
      } catch {
        // ignore
      }
    }

    return originalWrite(chunk, ...args);
  } as typeof stream.write;

  return stream;
}

/**
 * Truncate log file to keep only the last KEEP_SIZE bytes
 */
function truncateLogFile(path: string): void {
  try {
    const content = readFileSync(path);
    if (content.length > MAX_LOG_SIZE) {
      const kept = content.slice(-KEEP_SIZE);
      // Find first newline to avoid cutting mid-line
      const newlineIdx = kept.indexOf(10); // \n
      const trimmed = newlineIdx > 0 ? kept.slice(newlineIdx + 1) : kept;
      writeFileSync(path, trimmed);
    }
  } catch {
    // ignore
  }
}

/**
 * Read the last N lines from a log file
 */
export function readLastLines(path: string, n: number): string[] {
  if (!existsSync(path)) return [];

  try {
    const content = readFileSync(path, "utf-8");
    const lines = content.split("\n");
    // Remove trailing empty line if present
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }
    return lines.slice(-n);
  } catch {
    return [];
  }
}

/**
 * Read entire log file
 */
export function readLog(path: string): string {
  if (!existsSync(path)) return "";
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}
