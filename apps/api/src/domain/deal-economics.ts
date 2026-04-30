import type {
  DealEconomics,
  DealPricingRule,
  DealPricingStatus,
  DealSnapshot
} from "@bitrix24-reporting/contracts";

export type DealEconomicsContext = "finalWon" | "pipelinePlan";

export const DEFAULT_PRICING_RULES: DealPricingRule[] = [
  {
    id: "clubfirst-federal",
    customerLabel: "ClubFirst Russia / One",
    tariffLabel: "Федеральный",
    attractionRevenueAmount: 300_000,
    enabled: true,
    sortOrder: 10,
    updatedAt: null
  },
  {
    id: "clubfirst-regional",
    customerLabel: "ClubFirst Russia / One",
    tariffLabel: "Региональный",
    attractionRevenueAmount: 225_000,
    enabled: true,
    sortOrder: 20,
    updatedAt: null
  },
  {
    id: "clubfirst-globall",
    customerLabel: "ClubFirst GlobAll",
    tariffLabel: "Цифровой / GlobAll",
    attractionRevenueAmount: 150_000,
    enabled: true,
    sortOrder: 30,
    updatedAt: null
  },
  {
    id: "clubfirst-future",
    customerLabel: "ClubFirst Future",
    tariffLabel: "CFF / Федеральный",
    attractionRevenueAmount: 181_000,
    enabled: true,
    sortOrder: 40,
    updatedAt: null
  }
];

interface ResolveDealEconomicsInput {
  deal: DealSnapshot;
  context: DealEconomicsContext;
  pricingRules?: DealPricingRule[];
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasToken(value: string, tokens: string[]) {
  return tokens.some((token) => value.includes(token));
}

function cleanField(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || /^\d+$/.test(trimmed) || trimmed === "Неизвестная таргет-группа") {
    return null;
  }

  return trimmed;
}

function isCffTariff(value: string) {
  return hasToken(value, ["cff", "clubfirst future", "future"]);
}

function isFutureCustomer(value: string) {
  return hasToken(value, ["clubfirst future", "future", "cff"]);
}

function isGlobAll(value: string) {
  return hasToken(value, ["globall", "global", "цифров"]);
}

function isRussiaOrOne(value: string) {
  return hasToken(value, [
    "clubfirst russia",
    "club first russia",
    "russia",
    "clubfirst one",
    "club first one",
    "club one",
    "one"
  ]);
}

function isRegionalTariff(value: string) {
  return hasToken(value, ["регион"]);
}

function isFederalTariff(value: string) {
  return hasToken(value, ["федерал", "federal"]);
}

function findRule(ruleId: string, pricingRules: DealPricingRule[]) {
  return pricingRules.find((rule) => rule.id === ruleId && rule.enabled);
}

function resolveRuleId(input: {
  customerValue: string;
  tariffValue: string;
  dealId: string;
}) {
  const customer = normalizeText(input.customerValue);
  const tariff = normalizeText(input.tariffValue);
  const pricingWarnings: string[] = [];

  if (isCffTariff(tariff)) {
    let pricingStatus: DealPricingStatus = "priced";
    if (customer && !isFutureCustomer(customer)) {
      pricingStatus = "conflict";
      pricingWarnings.push(
        `Deal ${input.dealId}: CFF tariff priced as ClubFirst Future while target group is "${input.customerValue}".`
      );
    }

    return {
      ruleId: "clubfirst-future",
      pricingStatus,
      pricingWarnings
    };
  }

  if (isFutureCustomer(customer) && isFederalTariff(tariff)) {
    return {
      ruleId: "clubfirst-future",
      pricingStatus: "priced" as const,
      pricingWarnings
    };
  }

  if (isGlobAll(customer) || isGlobAll(tariff)) {
    return {
      ruleId: "clubfirst-globall",
      pricingStatus: "priced" as const,
      pricingWarnings
    };
  }

  if (isRussiaOrOne(customer)) {
    if (isRegionalTariff(tariff)) {
      return {
        ruleId: "clubfirst-regional",
        pricingStatus: "priced" as const,
        pricingWarnings
      };
    }

    if (isFederalTariff(tariff)) {
      return {
        ruleId: "clubfirst-federal",
        pricingStatus: "priced" as const,
        pricingWarnings
      };
    }
  }

  return {
    ruleId: null,
    pricingStatus: "missingPricingRule" as const,
    pricingWarnings: [
      `Deal ${input.dealId}: no pricing rule for customer "${input.customerValue}" and tariff "${input.tariffValue}".`
    ]
  };
}

export function resolveDealEconomics(
  input: ResolveDealEconomicsInput
): DealEconomics {
  const membershipAmount = input.deal.opportunity ?? 0;
  const pricingRules = input.pricingRules ?? DEFAULT_PRICING_RULES;
  const targetGroupValue = cleanField(input.deal.targetGroupValue);
  const businessClubValue = cleanField(input.deal.businessClubValue);
  const tariffValue = cleanField(input.deal.tariffValue);

  const customerValue =
    input.context === "finalWon"
      ? targetGroupValue
      : targetGroupValue ?? businessClubValue;
  const resolvedTariffValue =
    input.context === "pipelinePlan" ? tariffValue ?? "Федеральный" : tariffValue;

  if (!resolvedTariffValue) {
    return {
      membershipAmount,
      attractionRevenueAmount: null,
      pricingStatus: "missingContractFields",
      pricingWarnings: [
        `Deal ${input.deal.id}: target group and tariff are required for ${input.context} pricing.`
      ]
    };
  }

  const shouldPriceByCffTariff = isCffTariff(normalizeText(resolvedTariffValue));
  if (!customerValue && !shouldPriceByCffTariff) {
    return {
      membershipAmount,
      attractionRevenueAmount: null,
      pricingStatus: "missingContractFields",
      pricingWarnings: [
        `Deal ${input.deal.id}: target group and tariff are required for ${input.context} pricing.`
      ]
    };
  }

  const resolved = resolveRuleId({
    customerValue: customerValue ?? "",
    tariffValue: resolvedTariffValue,
    dealId: input.deal.id
  });

  if (!resolved.ruleId) {
    return {
      membershipAmount,
      attractionRevenueAmount: null,
      pricingStatus: resolved.pricingStatus,
      pricingWarnings: resolved.pricingWarnings
    };
  }

  const rule = findRule(resolved.ruleId, pricingRules);
  if (!rule) {
    return {
      membershipAmount,
      attractionRevenueAmount: null,
      pricingStatus: "missingPricingRule",
      pricingWarnings: [
        ...resolved.pricingWarnings,
        `Deal ${input.deal.id}: pricing rule "${resolved.ruleId}" is missing or disabled.`
      ]
    };
  }

  return {
    membershipAmount,
    attractionRevenueAmount: rule.attractionRevenueAmount,
    pricingStatus: resolved.pricingStatus,
    pricingWarnings: resolved.pricingWarnings
  };
}
