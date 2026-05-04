const CODEX_APP_SERVER_GLOBAL_EVENT_SET_KEY = Symbol.for(
  "openclaw.codexAppServerGlobalAgentEvents",
);

function globalEventSet(): WeakSet<object> {
  const state = globalThis as Record<symbol, WeakSet<object> | undefined>;
  state[CODEX_APP_SERVER_GLOBAL_EVENT_SET_KEY] ??= new WeakSet<object>();
  return state[CODEX_APP_SERVER_GLOBAL_EVENT_SET_KEY];
}

export function markCodexAppServerEventGloballyEmitted<T extends object>(event: T): T {
  globalEventSet().add(event);
  return event;
}
