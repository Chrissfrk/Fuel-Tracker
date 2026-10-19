export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Network failure (offline, server down) — distinct from an HTTP error response. */
export class NetworkError extends Error {}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
export const onUnauthorized = (fn: Listener) => {
  unauthorizedListeners.add(fn);
  return () => {
    unauthorizedListeners.delete(fn);
  };
};

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const { json, timeoutMs = 20000, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      ...rest,
      headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      signal: rest.signal ?? ctrl.signal,
    });
  } catch {
    throw new NetworkError('No connection');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    unauthorizedListeners.forEach((fn) => fn());
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, message);
  }
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? res.json() : res.blob()) as Promise<T>;
}

export function errorMessage(err: unknown): string {
  if (err instanceof NetworkError) return "You're offline. Try again when you have a connection.";
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
