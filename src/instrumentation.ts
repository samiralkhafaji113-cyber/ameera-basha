import type { Instrumentation } from "next";
import { logError } from "@/lib/log";

/**
 * Production error tracking without a third-party service: every unhandled server error is written as ONE redacted JSON
 * line (Vercel → Logs). Only the route, method and Next's error digest are recorded – never headers, cookies, bodies
 * or query strings (which could hold customer data). Plug an external tracker in here later if needed.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  logError(`${context.routeType}:${context.routePath}`, error, {
    method: request.method,
    path: request.path.split("?")[0],
  });
};
