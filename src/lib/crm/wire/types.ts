import type { Lead, LeadBookSnapshot } from "../types";

export interface ListLeadsInput {
  view: string;
  vertical?: string;
  state?: string;
  emailVerify?: string;
  lifecycle?: string;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface ListLeadsResult {
  source: "mock" | "live";
  leads: Lead[];
  total: number;
  limit: number;
  offset: number;
}

export interface BookResult {
  source: "mock" | "live";
  book: LeadBookSnapshot;
}

export interface WireStatus {
  source: "mock" | "live";
  connected: boolean;
  tables: string[];
  locked: string[];
  message: string;
  env?: {
    host: "vercel" | "local";
    hasNextPublicSupabaseUrl: boolean;
    hasServiceRoleKey: boolean;
    hasAnonKey: boolean;
    keyKind: "service_role" | "anon" | "none";
    projectHint: string;
  };
}
