const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
export const API_BASE_URL = (configuredBase || 'http://localhost:3000/api/v1')
  .replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status, requestId, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
    this.errors = errors;
  }
}

export async function apiRequest(
  path,
  { method = 'GET', body, token, signal } = {},
) {
  const isBinaryBody = typeof Blob !== 'undefined' && body instanceof Blob;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body
          ? {
              'Content-Type': isBinaryBody
                ? body.type
                : 'application/json',
            }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body
        ? { body: isBinaryBody ? body : JSON.stringify(body) }
        : {}),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(
      `Could not connect to the API at ${API_BASE_URL}. Check the backend service and CORS configuration.`,
      0,
    );
  }

  let responseBody;
  try {
    responseBody = await response.json();
  } catch {
    throw new ApiError(
      `The API returned an invalid response (HTTP ${response.status}).`,
      response.status,
      response.headers.get('X-Request-Id'),
    );
  }

  if (!response.ok || responseBody?.success !== true) {
    const errors = Array.isArray(responseBody?.errors) ? responseBody.errors : [];
    const detail = errors
      .map(({ field, message }) =>
        field && message ? `${field}: ${message}` : message,
      )
      .filter(Boolean)
      .join(' ');
    throw new ApiError(
      detail ||
        responseBody?.message ||
        `API request failed (HTTP ${response.status}).`,
      response.status,
      responseBody?.requestId || response.headers.get('X-Request-Id'),
      errors,
    );
  }

  return responseBody;
}

export async function apiGet(path, { signal } = {}) {
  const response = await apiRequest(path, { method: 'GET', signal });
  return response.data;
}

export function queryString(values) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}
