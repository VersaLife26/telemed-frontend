import "server-only";

import { redirect } from "next/navigation";

import { ApiError } from "./errors";

/**
 * Turns the two errors that are really navigation events into navigation.
 *
 * `IP_NOT_ALLOWLISTED` and `UNAUTHORIZED` are not conditions a page can render
 * around: there is no version of the payment ledger that is useful to someone
 * the gateway will not talk to. Every server page funnels its fetch errors
 * through here first, so those two land on the page that explains them and
 * everything else is left for the caller to render inline.
 *
 * Returns the error unchanged when it is not one of the two, so the call site
 * reads `const err = routeFatal(result.error)` and carries on.
 */
export function routeFatal(error: ApiError): ApiError {
  if (error.code === "IP_NOT_ALLOWLISTED") {
    redirect("/ip-blocked");
  }
  if (error.code === "UNAUTHORIZED") {
    redirect("/login?reason=expired");
  }
  return error;
}
