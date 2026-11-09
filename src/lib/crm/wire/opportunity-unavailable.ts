/**
 * What a failed live opportunities read returns (RIV-1940). Zero rows plus an
 * explicit unavailable flag: a live deploy never answers with the demo pipeline.
 */

import type { Opportunity } from "../types";

export function unavailableOpportunities(
  limit: number,
  offset: number,
  reason: string,
): {
  source: "mock";
  opportunities: Opportunity[];
  total: number;
  limit: number;
  offset: number;
  unavailable: true;
  message: string;
} {
  return {
    source: "mock",
    opportunities: [],
    total: 0,
    limit,
    offset,
    unavailable: true,
    message: `LIVE failed (${reason}): opportunities unavailable.`,
  };
}
