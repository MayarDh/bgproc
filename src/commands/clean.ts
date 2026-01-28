import { defineCommand } from "citty";
import { unlinkSync, existsSync } from "node:fs";
import {
  readRegistry,
  removeProcess,
  isProcessRunning,
  getLogPaths,
} from "../registry.js";

export const cleanCommand = defineCommand({
  meta: {
    name: "clean",
    description: "Remove dead processes and their logs",
  },
  args: {
    name: {
      type: "positional",
      description: "Process name (or --all for all dead processes)",
      required: false,
    },
    all: {
      type: "boolean",
      alias: "a",
      description: "Clean all dead processes",
    },
    logs: {
      type: "boolean",
      alias: "l",
      description: "Also remove log files",
      default: true,
    },
  },
  run({ args }) {
    const registry = readRegistry();
    const cleaned: string[] = [];

    if (args.all) {
      // Clean all dead processes
      for (const [name, entry] of Object.entries(registry)) {
        if (!isProcessRunning(entry.pid)) {
          cleanProcess(name, args.logs !== false);
          cleaned.push(name);
        }
      }
    } else if (args.name) {
      const name = args.name;
      const entry = registry[name];

      if (!entry) {
        console.error(`Process '${name}' not found`);
        process.exit(1);
      }

      if (isProcessRunning(entry.pid)) {
        console.error(
          `Process '${name}' is still running. Use 'bgproc stop ${name}' first.`,
        );
        process.exit(1);
      }

      cleanProcess(name, args.logs !== false);
      cleaned.push(name);
    } else {
      console.error("Specify a process name or use --all");
      process.exit(1);
    }

    console.log(
      JSON.stringify({
        cleaned,
        count: cleaned.length,
      }),
    );
  },
});

function cleanProcess(name: string, removeLogs: boolean): void {
  removeProcess(name);

  if (removeLogs) {
    const logPaths = getLogPaths(name);
    try {
      if (existsSync(logPaths.stdout)) unlinkSync(logPaths.stdout);
      if (existsSync(logPaths.stderr)) unlinkSync(logPaths.stderr);
    } catch {
      // ignore
    }
  }
}
