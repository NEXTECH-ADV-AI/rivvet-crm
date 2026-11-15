// Shared preview-only DTO. No credentials or business snapshots belong in this file.
export const CEO_SOURCE_SITE_ID = "appgprj_6af47ebfac84819196eab5b46618fc3d";
export const PREVIEW_MAX_AGE_MS = 30 * 60 * 60 * 1000;
export type MorningPriority = {
  title: string;
  action: string;
  label: string;
  tone: "urgent" | "waiting" | "good" | "empty" | "";
  owner: string;
  due: string;
  url: string;
  sourceLabel: string;
};
export type MorningCustomer = {
  name: string;
  state: "action" | "waiting" | "monitor";
  status: string;
  action: string;
  lastContact: string;
  url: string;
  issueUrl: string;
};
export type MorningSource = {
  name: string;
  status: "ok" | "partial" | "stale" | "unavailable";
  checkedAt: string | null;
  note: string;
};
export type MorningSnapshot = {
  schemaVersion: 1;
  runId: string;
  generatedAt: string;
  period: { label: string; start: string; end: string };
  brief: { title: string; subtitle: string; detail: string };
  priorities: MorningPriority[];
  customers: MorningCustomer[];
  sources: MorningSource[];
  sales: Record<string, unknown>;
  engineering: Record<string, unknown>;
  agenda: Record<string, unknown>[];
};
export type MorningEnvelope = {
  schemaVersion: 1;
  environment: "preview";
  syncedAt: string;
  sourceSiteId: typeof CEO_SOURCE_SITE_ID;
  snapshot: MorningSnapshot;
};
export type MorningBriefView = Pick<
  MorningSnapshot,
  "generatedAt" | "brief" | "priorities" | "customers" | "sources"
> & { syncedAt: string; stale: boolean; partial: boolean };
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length <= 20_000;
const texts = (v: Record<string, unknown>, keys: string[]) => keys.every((key) => text(v[key]));
const bounded = (v: unknown[], max: number) => v.length <= max;
export function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
const optionalUrl = (v: unknown) => v === "" || v == null || !!safeHttpUrl(v);
export function pastTimestamp(value: unknown, now: number): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    Date.parse(value) <= now
  );
}
function withinSize(value: unknown): boolean {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= 1_000_000;
  } catch {
    return false;
  }
}
export function validateMorningEnvelope(value: unknown, now = Date.now()): MorningEnvelope | null {
  if (
    !record(value) ||
    !withinSize(value) ||
    value.schemaVersion !== 1 ||
    value.environment !== "preview" ||
    value.sourceSiteId !== CEO_SOURCE_SITE_ID ||
    !pastTimestamp(value.syncedAt, now)
  )
    return null;
  const s = value.snapshot;
  if (
    !record(s) ||
    s.schemaVersion !== 1 ||
    !text(s.runId) ||
    !s.runId ||
    s.runId.length > 200 ||
    !pastTimestamp(s.generatedAt, now) ||
    Date.parse(s.generatedAt) > Date.parse(value.syncedAt)
  )
    return null;
  if (
    !record(s.period) ||
    !texts(s.period, ["label", "start", "end"]) ||
    !pastTimestamp(s.period.start, now) ||
    !pastTimestamp(s.period.end, now) ||
    Date.parse(s.period.start) >= Date.parse(s.period.end)
  )
    return null;
  if (!record(s.brief) || !texts(s.brief, ["title", "subtitle", "detail"])) return null;
  if (
    !Array.isArray(s.priorities) ||
    !bounded(s.priorities, 30) ||
    !s.priorities.every(
      (p) =>
        record(p) &&
        texts(p, ["title", "action", "label", "owner", "due", "url", "sourceLabel"]) &&
        typeof p.tone === "string" &&
        ["urgent", "waiting", "good", "empty", ""].includes(p.tone) &&
        optionalUrl(p.url),
    )
  )
    return null;
  if (
    !Array.isArray(s.customers) ||
    !bounded(s.customers, 100) ||
    !s.customers.every(
      (c) =>
        record(c) &&
        texts(c, ["name", "status", "action", "lastContact", "url", "issueUrl"]) &&
        typeof c.state === "string" &&
        ["action", "waiting", "monitor"].includes(c.state) &&
        optionalUrl(c.url) &&
        optionalUrl(c.issueUrl),
    )
  )
    return null;
  if (
    !Array.isArray(s.sources) ||
    !bounded(s.sources, 100) ||
    !s.sources.every(
      (source) =>
        record(source) &&
        texts(source, ["name", "note"]) &&
        typeof source.status === "string" &&
        ["ok", "partial", "stale", "unavailable"].includes(source.status) &&
        (source.checkedAt == null || source.checkedAt === ""
          ? source.status !== "ok"
          : pastTimestamp(source.checkedAt, now)),
    )
  )
    return null;
  if (
    !record(s.sales) ||
    !record(s.engineering) ||
    !Array.isArray(s.agenda) ||
    !bounded(s.agenda, 100) ||
    !s.agenda.every(record)
  )
    return null;
  return value as MorningEnvelope;
}
export function morningIsStale(generatedAt: string, now = Date.now()): boolean {
  if (now - Date.parse(generatedAt) > PREVIEW_MAX_AGE_MS) return true;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const local = (date: number) =>
    Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  const current = local(now);
  const source = local(Date.parse(generatedAt));
  const day = (parts: Record<string, string>) => `${parts.year}-${parts.month}-${parts.day}`;
  return `${current.hour}:${current.minute}` >= "07:30" && day(source) < day(current);
}

export function parseMorningBriefEnvelope(
  value: unknown,
  now = Date.now(),
): MorningBriefView | null {
  const envelope = validateMorningEnvelope(value, now);
  if (!envelope) return null;
  const { generatedAt, brief, priorities, customers, sources } = envelope.snapshot;
  return {
    generatedAt,
    syncedAt: envelope.syncedAt,
    brief: { title: brief.title, subtitle: brief.subtitle, detail: brief.detail },
    priorities: priorities.map(({ title, action, label, tone, owner, due, url, sourceLabel }) => ({
      title,
      action,
      label,
      tone,
      owner,
      due,
      url,
      sourceLabel,
    })),
    customers: customers.map(({ name, state, status, action, lastContact, url, issueUrl }) => ({
      name,
      state,
      status,
      action,
      lastContact,
      url,
      issueUrl,
    })),
    sources: sources.map(({ name, status, checkedAt, note }) => ({
      name,
      status,
      checkedAt: checkedAt || null,
      note,
    })),
    stale: morningIsStale(generatedAt, now),
    partial:
      sources.length === 0 ||
      sources.some(
        (source) =>
          source.status !== "ok" ||
          !source.checkedAt ||
          now - Date.parse(source.checkedAt) > PREVIEW_MAX_AGE_MS,
      ),
  };
}
