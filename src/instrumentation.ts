import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (_error, _request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportOperationalError } = await import("./lib/error-monitoring");
  // Classify the route template, never log the request path, query, cookie,
  // customer input, error message or stack trace in the operational store.
  const route = context.routePath;
  const area = /payment/.test(route) ? "payment" : /checkout|cart|booking/.test(route) ? "booking" : /host|crm|poster/.test(route) ? "host" : /settings|admin/.test(route) ? "settings" : /tour-chat/.test(route) ? "chat" : /tours/.test(route) ? "tours" : "site";
  await reportOperationalError("server_error", area);
};
