#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rawArgs = process.argv.slice(2);
const forwardedArgs = [];

for (let i = 0; i < rawArgs.length; i += 1) {
  const arg = rawArgs[i];
  if (arg === "--") {
    continue;
  }
  // Skip Turbo filter arguments in various formats
  if (arg === "--filter") {
    // Skip the standalone value Turbo forwards after "--filter".
    i += 1;
    continue;
  }
  if (arg.startsWith("--filter=") || arg === "filter=mobile" || arg.startsWith("filter=")) {
    continue;
  }
  forwardedArgs.push(arg);
}

const hasHostFlag = forwardedArgs.some((arg) => arg === "--host" || arg.startsWith("--host="));
const finalArgs = [...forwardedArgs];

// Default to Dev Client so we don't accidentally open Expo Go (which won't have custom native modules like ios-insights).
// Users can still force Expo Go explicitly with `--go`, or pass `--dev-client` themselves.
const hasDevClientFlag = forwardedArgs.includes("--dev-client");
const hasGoFlag = forwardedArgs.includes("--go");

if (!hasDevClientFlag && !hasGoFlag) {
  finalArgs.push("--dev-client");
}

if (!hasHostFlag) {
  finalArgs.push("--host", "localhost");
}

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const expoCli = path.resolve(appRoot, "node_modules/expo/bin/cli");
const child = spawn(process.execPath, [expoCli, "start", ...finalArgs], {
  stdio: "inherit",
  env: {
    ...process.env,
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
