import type { Account, Contact, Lead, LeadBookSnapshot } from "../types";

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

export interface ListAccountsInput {
  view?: string;
  query?: string;
  vertical?: string;
  state?: string;
  lifecycle?: string;
  sort?: "recent" | "name" | "score";
  limit?: number;
  offset?: number;
}

export interface ListAccountsResult {
  source: "mock" | "live";
  accounts: Account[];
  total: number;
  limit: number;
  offset: number;
  message?: string;
}

export interface GetAccountResult {
  source: "mock" | "live";
  account: Account | null;
  contacts: Contact[];
  message?: string;
}

export interface AccountsFunnel {
  source: "mock" | "live";
  total: number;
  customers: number;
  opportunities: number;
  engaged: number;
  prospects: number;
  churned: number;
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
