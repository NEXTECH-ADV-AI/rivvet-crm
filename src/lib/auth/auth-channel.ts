/**
 * Cross-tab sign-in hand-off (RIV-1544). When the email link opens a new tab,
 * that tab signs in and tells the tab that asked for the link; the asking tab
 * moves on to Home, so the person keeps working where they started.
 * Same browser profile only: BroadcastChannel never leaves the device.
 */
const NAME = "rivvet-crm-auth";
type Msg = { type: "signed-in" } | { type: "ack" };

function open(): BroadcastChannel | null {
  return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(NAME);
}

/** Login tab: wait for a sign-in from another tab, answer it, then run onSignedIn. */
export function listenForSignIn(onSignedIn: () => void): () => void {
  const ch = open();
  if (!ch) return () => {};
  ch.onmessage = (e: MessageEvent<Msg>) => {
    if (e.data?.type !== "signed-in") return;
    ch.postMessage({ type: "ack" } satisfies Msg);
    onSignedIn();
  };
  return () => ch.close();
}

/** Link tab: announce the sign-in; true when a waiting login tab answered. */
export function announceSignIn(waitMs = 700): Promise<boolean> {
  const ch = open();
  if (!ch) return Promise.resolve(false);
  return new Promise((resolve) => {
    const done = (answered: boolean) => {
      clearTimeout(timer);
      ch.close();
      resolve(answered);
    };
    const timer = setTimeout(() => done(false), waitMs);
    ch.onmessage = (e: MessageEvent<Msg>) => {
      if (e.data?.type === "ack") done(true);
    };
    ch.postMessage({ type: "signed-in" } satisfies Msg);
  });
}
