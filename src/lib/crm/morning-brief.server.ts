import { parseMorningBriefEnvelope, type MorningBriefView } from "./preview-config-contract";

export type MorningBriefResult =
  | { status: "hidden" }
  | { status: "unavailable"; message: string }
  | { status: "ready"; brief: MorningBriefView };

type Dependencies = {
  readSession?: () => { email: string } | null | Promise<{ email: string } | null>;
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  now?: number;
};
const MAX_BYTES = 1_000_000;

async function boundedJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get("content-length")) > MAX_BYTES || !response.body)
    throw new Error("Invalid brief response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error("Brief exceeds size limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

/** The existing signed CRM session is checked before reading config or making any request. */
export async function readFounderMorningBrief(
  deps: Dependencies = {},
): Promise<MorningBriefResult> {
  const readSession =
    deps.readSession ??
    (async () => {
      const { readCrmSession } = await import("../auth/crm-session.server");
      return readCrmSession();
    });
  let session: { email: string } | null;
  try {
    session = await readSession();
  } catch {
    return { status: "hidden" };
  }
  if (session?.email !== "brayden@rivvetai.com") return { status: "hidden" };
  const env = deps.env ?? process.env;
  if (env.VERCEL_ENV !== "preview") return { status: "hidden" };
  const id = env.RIVVET_PREVIEW_CONFIG_ID;
  const token = env.RIVVET_PREVIEW_CONFIG_TOKEN;
  if (!id || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !token || token.length > 4096) {
    return {
      status: "unavailable",
      message: "The private morning brief is not connected to this preview yet.",
    };
  }
  try {
    const response = await (deps.fetch ?? fetch)(
      `https://global-config.vercel.com/${encodeURIComponent(id)}/item/morning_brief`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) throw new Error("Brief read failed");
    const brief = parseMorningBriefEnvelope(await boundedJson(response), deps.now ?? Date.now());
    if (!brief) throw new Error("Invalid brief shape");
    return { status: "ready", brief };
  } catch {
    // Never expose credentials, provider response bodies or partial private JSON in an error.
    return {
      status: "unavailable",
      message:
        "The morning brief could not be verified. Existing CRM data below remains available.",
    };
  }
}
