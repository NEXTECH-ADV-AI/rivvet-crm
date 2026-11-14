import { createServerFn } from "@tanstack/react-start";
import { requireCrmSession } from "../auth/crm-session";

export const getFounderMorningBriefFn = createServerFn({ method: "GET" })
  .middleware([requireCrmSession])
  .handler(async () => {
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("Cache-Control", "private, no-store, max-age=0");
    setResponseHeader("Vary", "Cookie");
    const { readFounderMorningBrief } = await import("./morning-brief.server");
    return readFounderMorningBrief();
  });
