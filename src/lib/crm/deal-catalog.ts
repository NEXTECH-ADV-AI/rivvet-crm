/**
 * Deal / contract catalog — production CRM builders (service + commerce).
 * Sacred send path stays locked.
 */

import {
  COMMERCE_DEAL_TYPE,
  COMMERCE_MONTHLY_RETAINER,
  COMMERCE_PERF,
  COMMERCE_PRODUCT_DESCRIPTION,
  COMMERCE_PRODUCT_NAME,
  COMMERCE_SETUP_FEE,
  SERVICE_SETUP_FEE,
  SERVICE_UNLIMITED_PLAN,
  SERVICE_UNLIMITED_PRICE,
  SERVICE_VALUE_BASED_PLAN,
  SERVICE_VALUE_PRICE,
  type CommercePerfOption,
} from "./prod-mirror";
import type { ForecastCategory } from "./types";

export type ServicePlanId = "unlimited" | "value_based";
export type ContractTermMonths = 6 | 12 | 24;
export type FreeMonths = 0 | 1 | 2 | 3;
export type PaymentCadence =
  | "Monthly · Auto-pay"
  | "Annual · Prepay"
  | "Annual · Paid upfront";
export type DealBuilderTab = "rivvet_ai" | "commerce";

export interface ServiceSku {
  id: ServicePlanId;
  name: string;
  description: string;
  monthlyPrice: number;
  sku: string;
}

export const SERVICE_SKUS: ServiceSku[] = [
  {
    id: "unlimited",
    name: SERVICE_UNLIMITED_PLAN,
    description: "Flat monthly rate · unlimited bookings",
    monthlyPrice: SERVICE_UNLIMITED_PRICE,
    sku: "rivvet_ai_unlimited",
  },
  {
    id: "value_based",
    name: SERVICE_VALUE_BASED_PLAN,
    description: "Platform fee + per-booking billing",
    monthlyPrice: SERVICE_VALUE_PRICE,
    sku: "rivvet_ai_value_based",
  },
];

export const TERM_OPTIONS: { value: ContractTermMonths; label: string }[] = [
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
  { value: 24, label: "24 months" },
];

export const FREE_MONTH_OPTIONS: { value: FreeMonths; label: string }[] = [
  { value: 0, label: "None" },
  { value: 1, label: "1 free" },
  { value: 2, label: "2 free" },
  { value: 3, label: "3 free" },
];

export const PAYMENT_OPTIONS: { value: PaymentCadence; label: string }[] = [
  { value: "Monthly · Auto-pay", label: "Monthly · Auto-pay" },
  { value: "Annual · Prepay", label: "Annual · Prepay" },
  { value: "Annual · Paid upfront", label: "Annual · Paid upfront" },
];

export const FORECAST_OPTIONS: {
  value: ForecastCategory;
  label: string;
}[] = [
  { value: "pipeline", label: "Pipeline" },
  { value: "best_case", label: "Best case" },
  { value: "commit", label: "Commit" },
  { value: "omitted", label: "Omitted" },
  { value: "closed", label: "Closed" },
];

export interface DealDraft {
  tab: DealBuilderTab;
  productId: ServicePlanId | null;
  termMonths: ContractTermMonths;
  freeMonths: FreeMonths;
  payment: PaymentCadence;
  startDate: string;
  setupFee: number;
  monthlyDiscount: number;
  commerceSetupFee: number;
  commerceMonthlyRetainer: number;
  performanceOption: CommercePerfOption | "";
  customPerfRate: number;
  customPerfTermMonths: number;
  effectiveDate: string;
  launchDateTarget: string;
}

export function emptyDealDraft(startDate: string): DealDraft {
  const launch = new Date(startDate);
  launch.setDate(launch.getDate() + 14);
  return {
    tab: "rivvet_ai",
    productId: null,
    termMonths: 12,
    freeMonths: 0,
    payment: "Monthly · Auto-pay",
    startDate,
    setupFee: SERVICE_SETUP_FEE,
    monthlyDiscount: 0,
    commerceSetupFee: COMMERCE_SETUP_FEE,
    commerceMonthlyRetainer: COMMERCE_MONTHLY_RETAINER,
    performanceOption: "",
    customPerfRate: 10,
    customPerfTermMonths: 6,
    effectiveDate: startDate,
    launchDateTarget: launch.toISOString().slice(0, 10),
  };
}

export function commercePerfTerms(deal: DealDraft): {
  label: string;
  rate: number;
  termMonths: number;
} | null {
  if (deal.tab !== "commerce" || !deal.performanceOption) return null;
  if (deal.performanceOption === "custom") {
    return {
      label: "Custom",
      rate: deal.customPerfRate,
      termMonths: deal.customPerfTermMonths,
    };
  }
  const p = COMMERCE_PERF[deal.performanceOption];
  return p ? { label: p.label, rate: p.rate, termMonths: p.termMonths } : null;
}

export function priceDeal(deal: DealDraft): {
  mode: "service" | "commerce";
  product: ServiceSku | null;
  productName: string | null;
  monthly: number;
  tcv: number;
  setupFee: number;
  setup: number;
  billableMonths: number;
  label: string;
  perf: { rate: number; termMonths: number } | null;
} {
  if (deal.tab === "commerce") {
    const perf = commercePerfTerms(deal);
    const months = perf?.termMonths ?? 12;
    const monthly = deal.commerceMonthlyRetainer;
    return {
      mode: "commerce",
      product: null,
      productName: COMMERCE_PRODUCT_NAME,
      monthly,
      tcv: deal.commerceSetupFee + monthly * months,
      setupFee: deal.commerceSetupFee,
      setup: deal.commerceSetupFee,
      billableMonths: months,
      label: COMMERCE_PRODUCT_NAME,
      perf: perf
        ? { rate: perf.rate, termMonths: perf.termMonths }
        : null,
    };
  }
  const product =
    SERVICE_SKUS.find((s) => s.id === deal.productId) ?? null;
  const monthly = Math.max(
    0,
    (product?.monthlyPrice ?? 0) - (deal.monthlyDiscount || 0),
  );
  const billableMonths = Math.max(0, deal.termMonths - deal.freeMonths);
  return {
    mode: "service",
    product,
    productName: product?.name ?? null,
    monthly,
    tcv: deal.setupFee + monthly * billableMonths,
    setupFee: deal.setupFee,
    setup: deal.setupFee,
    billableMonths,
    label: product?.name ?? "Rivvet AI",
    perf: null,
  };
}

export {
  COMMERCE_DEAL_TYPE,
  COMMERCE_PRODUCT_DESCRIPTION,
  COMMERCE_PRODUCT_NAME,
  COMMERCE_PERF,
  COMMERCE_SETUP_FEE,
  COMMERCE_MONTHLY_RETAINER,
  SERVICE_SETUP_FEE,
};
