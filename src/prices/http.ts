const TIMEOUT_MS = 10_000;

export async function getJson<T = unknown>(url: string, headers?: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url.split('/')[2]}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface Quote {
  price: number;
  currency: string;
}
