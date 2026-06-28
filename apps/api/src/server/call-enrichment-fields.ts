export type CallEnrichmentEntityType = "contact" | "deal";

export type CallEnrichmentValueKind =
  | "string"
  | "integer"
  | "double"
  | "enum"
  | "url"
  | "crm_multiple"
  | "iblock_element";

export interface CallEnrichmentFieldDescriptor {
  logicalKey: string;
  entityType: CallEnrichmentEntityType;
  bitrixFieldCode: string;
  title: string;
  valueKind: CallEnrichmentValueKind;
  multiple: boolean;
  writableInV1: boolean;
  enumOptions?: Array<{ id: string; label: string }>;
  externalCatalog?: { kind: "dynamic" | "iblock"; id: string };
}

export const CALL_ENRICHMENT_CONTACT_FIELDS = [
  {
    logicalKey: "gender",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1643718541418",
    title: "Пол",
    valueKind: "enum",
    multiple: false,
    writableInV1: true,
    enumOptions: [
      { id: "460", label: "Муж" },
      { id: "462", label: "Жен" }
    ]
  },
  {
    logicalKey: "city",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1649418456",
    title: "Город проживания участника",
    valueKind: "crm_multiple",
    multiple: true,
    writableInV1: false,
    externalCatalog: { kind: "dynamic", id: "DYNAMIC_131" }
  },
  {
    logicalKey: "age",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1766136147",
    title: "Возраст",
    valueKind: "integer",
    multiple: false,
    writableInV1: true
  },
  {
    logicalKey: "relevantExperienceYears",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1766145168923",
    title: "Релевантный совокупный опыт работы",
    valueKind: "double",
    multiple: false,
    writableInV1: true
  },
  {
    logicalKey: "businessRevenue",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1647946359",
    title: "Оборот бизнеса",
    valueKind: "enum",
    multiple: false,
    writableInV1: true,
    enumOptions: [
      { id: "7116", label: "до 20 млн. рублей" },
      { id: "5324", label: "20-50 млн. рублей" },
      { id: "5326", label: "50-150 млн. рублей" },
      { id: "4464", label: "150-500 млн. рублей" },
      { id: "602", label: "500-1000 млн. рублей" },
      { id: "604", label: "1-3 млрд. рублей" },
      { id: "606", label: "3-10 млрд. рублей" },
      { id: "614", label: "10-15 млрд. рублей" },
      { id: "616", label: "свыше 15 млрд. рублей" }
    ]
  },
  {
    logicalKey: "primaryIndustry",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1667127836",
    title: "Сфера деятельности основная",
    valueKind: "iblock_element",
    multiple: false,
    writableInV1: false,
    externalCatalog: { kind: "iblock", id: "76" }
  },
  {
    logicalKey: "companySpecifics",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1643721389",
    title: "Специфика компании основная",
    valueKind: "string",
    multiple: false,
    writableInV1: true
  },
  {
    logicalKey: "primaryRole",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1643793756",
    title: "Роль/должность основная",
    valueKind: "enum",
    multiple: false,
    writableInV1: false
  },
  {
    logicalKey: "roleExperienceYears",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1766145312607",
    title: "Опыт в текущей должности",
    valueKind: "double",
    multiple: false,
    writableInV1: true
  },
  {
    logicalKey: "clubGoals",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1643816950",
    title: "Цели/задачи по клубу",
    valueKind: "string",
    multiple: false,
    writableInV1: true
  },
  {
    logicalKey: "wasInCommunity",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1765895191819",
    title: "Состоял ли в сообществе?",
    valueKind: "enum",
    multiple: false,
    writableInV1: true,
    enumOptions: [
      { id: "6608", label: "Да" },
      { id: "6610", label: "Нет" }
    ]
  },
  {
    logicalKey: "previousCommunityDetails",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1643816816",
    title: "Состоял ли ранее в каком-либо сообществе, если да, то в каком?",
    valueKind: "string",
    multiple: false,
    writableInV1: true
  },
  {
    logicalKey: "newProjects",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1667310772911",
    title: "Проекты: новые запускающиеся бизнесы участника",
    valueKind: "string",
    multiple: false,
    writableInV1: true
  },
  {
    logicalKey: "clubUsefulness",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1643816879",
    title: "Чем участник может быть полезен клубу",
    valueKind: "string",
    multiple: false,
    writableInV1: true
  },
  {
    logicalKey: "hobbies",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1643817006",
    title: "Увлечения/хобби",
    valueKind: "string",
    multiple: false,
    writableInV1: true
  },
  {
    logicalKey: "personalIncome",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1766145330402",
    title: "Личный доход",
    valueKind: "double",
    multiple: false,
    writableInV1: true
  },
  {
    logicalKey: "familyChildren",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1643817014",
    title: "Семья/дети",
    valueKind: "string",
    multiple: false,
    writableInV1: true
  },
  {
    logicalKey: "publicMentionsUrls",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1766147011846",
    title: "Ссылки на упоминания в сети",
    valueKind: "url",
    multiple: false,
    writableInV1: true
  },
  {
    logicalKey: "additionalInfo",
    entityType: "contact",
    bitrixFieldCode: "UF_CRM_1768223556404",
    title: "Дополнительная информация",
    valueKind: "string",
    multiple: false,
    writableInV1: true
  }
] as const satisfies readonly CallEnrichmentFieldDescriptor[];

export const CALL_ENRICHMENT_DEAL_FIELDS = [
  {
    logicalKey: "keyProjects",
    entityType: "deal",
    bitrixFieldCode: "UF_CRM_1766147164481",
    title: "Ключевые проекты",
    valueKind: "string",
    multiple: false,
    writableInV1: true
  },
  {
    logicalKey: "clubConnections",
    entityType: "deal",
    bitrixFieldCode: "UF_CRM_1766147207634",
    title: "Связи и знакомства внутри клуба",
    valueKind: "string",
    multiple: false,
    writableInV1: true
  }
] as const satisfies readonly CallEnrichmentFieldDescriptor[];

export const CALL_ENRICHMENT_FIELDS = [
  ...CALL_ENRICHMENT_CONTACT_FIELDS,
  ...CALL_ENRICHMENT_DEAL_FIELDS
] as const satisfies readonly CallEnrichmentFieldDescriptor[];

export const CALL_ENRICHMENT_CONTACT_FIELD_CODES =
  CALL_ENRICHMENT_CONTACT_FIELDS.map((field) => field.bitrixFieldCode);

export const CALL_ENRICHMENT_DEAL_FIELD_CODES =
  CALL_ENRICHMENT_DEAL_FIELDS.map((field) => field.bitrixFieldCode);

export const CALL_ENRICHMENT_ALL_FIELD_CODES = CALL_ENRICHMENT_FIELDS.map(
  (field) => field.bitrixFieldCode
);

const callEnrichmentFieldByCode = new Map<string, CallEnrichmentFieldDescriptor>(
  CALL_ENRICHMENT_FIELDS.map((field) => [field.bitrixFieldCode, field])
);

export function isCallEnrichmentFieldCode(value: string): boolean {
  return callEnrichmentFieldByCode.has(value);
}

export function getCallEnrichmentFieldByCode(code: string) {
  return callEnrichmentFieldByCode.get(code);
}

export function assertCallEnrichmentFieldAllowed(
  entityType: CallEnrichmentEntityType,
  fieldCode: string
) {
  const descriptor = getCallEnrichmentFieldByCode(fieldCode);

  if (!descriptor) {
    throw new Error(`Forbidden call enrichment field: ${fieldCode}`);
  }

  if (descriptor.entityType !== entityType) {
    throw new Error(
      `Call enrichment field ${fieldCode} belongs to ${descriptor.entityType}, not ${entityType}`
    );
  }

  return descriptor;
}
