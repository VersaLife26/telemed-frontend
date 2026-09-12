/**
 * Shown when the console cannot establish who the caller is.
 *
 * Two distinct states, deliberately worded differently, because the action is
 * different and neither is the operator's mistake:
 *
 *   unreachable      Access authenticated them, but this platform could not be
 *                    asked what they may do. Their session is fine; the
 *                    backend is not. Waiting is the right move.
 *   no-access-token  The request did not arrive through Cloudflare Access at
 *                    all, so there is nobody to identify. Opening the
 *                    hostname directly is the fix.
 */
export function ConsoleUnavailable({ reason }: { reason: "no-access-token" | "unreachable" }) {
  const unreachable = reason === "unreachable";

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-xl font-semibold">
        {unreachable ? "The console cannot reach the platform" : "Sign in through Cloudflare Access"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {unreachable ? (
          <>
            Your sign-in worked. The console could not confirm your admin role with the
            platform API, so it will not guess at what you are allowed to see. This is a
            problem on our side, not with your account.
          </>
        ) : (
          <>
            This request did not come through Cloudflare Access, so there is no identity to
            check. Open{" "}
            <span className="font-mono">admin.versalifehealth.com</span> directly in a browser
            and sign in when prompted.
          </>
        )}
      </p>
      {unreachable ? (
        <p className="text-sm text-muted-foreground">
          Reloading in a moment usually resolves it. If it persists, the cause is logged by
          the console Worker as <span className="font-mono">adminIdentity:</span> with the
          underlying error.
        </p>
      ) : null}
    </main>
  );
}
