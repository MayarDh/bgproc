import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

/**
 * Detect listening ports for a given PID using lsof
 */
export function detectPorts(pid: number): number[] {
  try {
    // Just filter by PID and look for LISTEN in the output
    // -P = show port numbers, -n = no DNS resolution
    const output = execSync(`lsof -p ${pid} -P -n 2>/dev/null | grep LISTEN`, {
      encoding: "utf-8",
    });
    const ports: number[] = [];
    for (const line of output.split("\n")) {
      // Format: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
      // NAME is like *:3000 or 127.0.0.1:3000 or [::1]:3000
      const match = line.match(/:(\d+)\s+\(LISTEN\)/);
      if (match) {
        ports.push(parseInt(match[1], 10));
      }
    }
    return [...new Set(ports)]; // dedupe
  } catch {
    return [];
  }
}

/**
 * Try to detect port from log output (for when lsof doesn't show it yet)
 */
export function detectPortFromLogs(logPath: string): number | null {
  if (!existsSync(logPath)) return null;

  try {
    const content = readFileSync(logPath, "utf-8");
    // Check last 50 lines for port announcements
    const lines = content.split("\n").slice(-50);

    const patterns = [
      /localhost:(\d+)/i,
      /127\.0\.0\.1:(\d+)/,
      /0\.0\.0\.0:(\d+)/,
      /port\s+(\d+)/i,
      /listening\s+(?:on\s+)?(?:port\s+)?:?(\d+)/i,
      /:\/\/[^:]+:(\d+)/,
    ];

    for (const line of lines.reverse()) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const port = parseInt(match[1], 10);
          if (port > 0 && port < 65536) {
            return port;
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}
