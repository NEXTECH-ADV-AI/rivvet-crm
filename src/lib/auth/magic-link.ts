/**
 * Passwordless magic-link — client-safe createServerFn wrappers.
 * Server logic lives in magic-link.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";

export const magicLinkEnabled = true;

export type RequestMagicLinkResult = {
  ok: true;
  previewUrl: string | null;
  emailed: boolean;
  redirectTo: string;
  rewritten: boolean;
};

export const requestMagicLinkFn = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; redirectTo: string }) => {
    const email = String(input?.email ?? "")
      .trim()
      .toLowerCase();
    const redirectTo = String(input?.redirectTo ?? "").trim();
    if (!email || !email.includes("@")) {
      throw new Error("Enter a valid work email");
    }
    if (!redirectTo || !/^https?:\/\//i.test(redirectTo)) {
      throw new Error("Invalid redirect URL");
    }
    return { email, redirectTo };
  })
  .handler(async ({ data }): Promise<RequestMagicLinkResult> => {
    if (!magicLinkEnabled) throw new Error("Magic link is disabled");
    const { requestMagicLinkServer } = await import("./magic-link.server");
    return requestMagicLinkServer(data);
  });

export const completeMagicLinkFn = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => {
    const accessToken = String(input?.accessToken ?? "").trim();
    if (!accessToken) throw new Error("Missing access token");
    return { accessToken };
  })
  .handler(async ({ data }) => {
    const { completeMagicLinkWithToken } = await import("./magic-link.server");
    return completeMagicLinkWithToken(data.accessToken);
  });

export const completeMagicLinkCodeFn = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => {
    const code = String(input?.code ?? "").trim();
    if (!code) throw new Error("Missing auth code");
    return { code };
  })
  .handler(async ({ data }) => {
    const { completeMagicLinkWithCode } = await import("./magic-link.server");
    return completeMagicLinkWithCode(data.code);
  });

export const completeMagicLinkTokenHashFn = createServerFn({ method: "POST" })
  .inputValidator((input: { tokenHash: string; type?: string }) => {
    const tokenHash = String(input?.tokenHash ?? "").trim();
    if (!tokenHash) throw new Error("Missing token hash");
    const type = input?.type ? String(input.type).trim() : undefined;
    return { tokenHash, type };
  })
  .handler(async ({ data }) => {
    const { completeMagicLinkWithTokenHash } = await import(
      "./magic-link.server"
    );
    return completeMagicLinkWithTokenHash(data);
  });
