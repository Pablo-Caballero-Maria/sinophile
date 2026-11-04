/**
 * Small helpers shared by the API route handlers (server only).
 */
import { NextResponse, type NextRequest } from "next/server";

/** An error whose message can be shown to the user (in Spanish). */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** JSON response that is never cached. */
export const json = (body: unknown, init?: ResponseInit): NextResponse => {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
};

/**
 * Reads a JSON object body.
 * Requiring `Content-Type: application/json` is also the CSRF defence: a page
 * on another site cannot send it without a CORS preflight, which is not allowed.
 */
export async function readJson(request: NextRequest, maxBytes = 100_000): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "La petición debe ser JSON.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new HttpError(413, "Los datos enviados son demasiado grandes.");
  let body: unknown;
  try {
    body = JSON.parse(text || "{}");
  } catch {
    throw new HttpError(400, "JSON no válido.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new HttpError(400, "Se esperaba un objeto JSON.");
  return body as Record<string, unknown>;
}

/** Wraps a route handler: HttpErrors become `{ error }` responses, anything else a generic 500. */
export function route(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
      console.error("[api]", request.method, request.nextUrl.pathname, error);
      return json({ error: "Error del servidor. Inténtalo de nuevo en un momento." }, { status: 500 });
    }
  };
}
