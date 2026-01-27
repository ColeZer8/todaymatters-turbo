import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  ts: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

const STORAGE_KEY = "tm:logs:v1";
const MAX_ENTRIES = 400;

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function getAppEnv(): string {
  try {
    // `extra.appEnv` is set in `app.config.js`.
    const extra = Constants.expoConfig?.extra as
      | Record<string, unknown>
      | undefined;
    const appEnv = extra?.appEnv;
    return typeof appEnv === "string" ? appEnv : "development";
  } catch {
    return "development";
  }
}

function shouldLogDebug(): boolean {
  if (__DEV__) return true;
  return getAppEnv() !== "production";
}

async function appendEntry(entry: LogEntry): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const current: LogEntry[] = raw ? (JSON.parse(raw) as LogEntry[]) : [];
    const next = [...current, entry].slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Never throw from logging.
  }
}

function writeToConsole(
  level: LogLevel,
  message: string,
  data?: unknown,
): void {
  // Keep console output minimal in production; still useful for adb logcat.
  const prefix = `[TM:${level}]`;
  if (data === undefined) {
    // eslint-disable-next-line no-console
    console[level === "debug" ? "log" : level](`${prefix} ${message}`);
    return;
  }
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](
    `${prefix} ${message} ${safeStringify(data)}`,
  );
}

async function logInternal(
  level: LogLevel,
  message: string,
  data?: unknown,
): Promise<void> {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    message,
    data,
  };

  // Persist warnings/errors always; persist debug/info only when enabled.
  if (level === "warn" || level === "error" || shouldLogDebug()) {
    void appendEntry(entry);
  }

  if (level === "warn" || level === "error" || shouldLogDebug()) {
    writeToConsole(level, message, data);
  }
}

export const logger = {
  debug(message: string, data?: unknown) {
    void logInternal("debug", message, data);
  },
  info(message: string, data?: unknown) {
    void logInternal("info", message, data);
  },
  warn(message: string, data?: unknown) {
    void logInternal("warn", message, data);
  },
  error(message: string, data?: unknown) {
    void logInternal("error", message, data);
  },
};

export async function getRecentLogsAsync(): Promise<LogEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as LogEntry[]) : [];
}

export async function clearLogsAsync(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function installGlobalErrorHandlers(): void {
  // Idempotent: stash on globalThis
  const g = globalThis as unknown as {
    __tmLoggerInstalled?: boolean;
    ErrorUtils?: any;
  };
  if (g.__tmLoggerInstalled) return;
  g.__tmLoggerInstalled = true;

  // React Native global exception handler
  const ErrorUtils = g.ErrorUtils as
    | undefined
    | {
        getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
        setGlobalHandler?: (
          handler: (error: unknown, isFatal?: boolean) => void,
        ) => void;
      };

  const previousHandler = ErrorUtils?.getGlobalHandler?.();
  ErrorUtils?.setGlobalHandler?.((error: unknown, isFatal?: boolean) => {
    logger.error("Uncaught JS error", {
      isFatal: Boolean(isFatal),
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    });
    previousHandler?.(error, isFatal);
  });

  // Best-effort unhandled promise rejection capture (varies by RN/JS engine)
  try {
    const anyGlobal = globalThis as unknown as {
      onunhandledrejection?: ((event: any) => void) | null;
    };
    const previous = anyGlobal.onunhandledrejection;
    anyGlobal.onunhandledrejection = (event: any) => {
      logger.error("Unhandled promise rejection", {
        reason: event?.reason ?? event,
      });
      previous?.(event);
    };
  } catch {
    // ignore
  }
}
