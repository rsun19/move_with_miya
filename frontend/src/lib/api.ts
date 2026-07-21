export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
  });

  if (!res.ok) {
    throw new ApiError(res.statusText, res.status);
  }

  return res.json();
}
