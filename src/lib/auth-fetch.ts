let getTokenFn: (() => Promise<string | null>) | null = null;

export function setGetTokenFn(fn: () => Promise<string | null>): void {
  getTokenFn = fn;
}

export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);

  if (getTokenFn) {
    const token = await getTokenFn();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    // Force sign-out by reloading — Clerk will catch the unauthenticated state
    window.location.reload();
  }

  return res;
}
