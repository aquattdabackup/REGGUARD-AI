import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export const API =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:8000"
    : "");
let client: SupabaseClient | null = null;
export function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return client;
}
export async function token() {
  const demo =
    typeof window !== "undefined"
      ? sessionStorage.getItem("regguard_demo")
      : null;
  if (demo) return demo;
  return (
    (await supabase()?.auth.getSession())?.data.session?.access_token ?? null
  );
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request(path: string, options: RequestInit = {}) {
  if (!API)
    throw new ApiError(
      "The hosted backend is not connected yet. The independent report verifier remains available.",
      503,
    );
  const access = await token();
  const headers = new Headers(options.headers);
  if (access) headers.set("Authorization", `Bearer ${access}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${API}/api/v1${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.error?.message || `Request failed (${response.status})`,
      response.status,
    );
  }
  return response;
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await request(path, options);
  return response.status === 204 ? (undefined as T) : response.json();
}
export async function download(path: string, filename: string) {
  const blob = await (await request(path)).blob();
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
