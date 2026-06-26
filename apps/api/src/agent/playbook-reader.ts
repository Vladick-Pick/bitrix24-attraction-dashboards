import { readFile } from "node:fs/promises";
import path from "node:path";

export interface PlaybookSection {
  sectionId: string;
  label: string;
  html: string;
  text: string;
}

export interface PlaybookSearchResult {
  sectionId: string;
  label: string;
  snippet: string;
}

export interface PlaybookSearchResponse {
  query: string;
  results: PlaybookSearchResult[];
}

export interface PlaybookReader {
  listSections(): Promise<PlaybookSection[]>;
  readSection(input: { sectionId: string }): Promise<PlaybookSection>;
  search(input: {
    query: string;
    limit?: number | undefined;
  }): Promise<PlaybookSearchResponse>;
}

export class PlaybookReaderError extends Error {
  readonly code: "PLAYBOOK_SECTION_NOT_FOUND" | "INVALID_INPUT";

  constructor(
    code: "PLAYBOOK_SECTION_NOT_FOUND" | "INVALID_INPUT",
    message: string
  ) {
    super(message);
    this.name = "PlaybookReaderError";
    this.code = code;
  }
}

export interface CreatePlaybookReaderInput {
  htmlPath?: string;
  readHtml?: () => Promise<string>;
  defaultLimit?: number;
  maxLimit?: number;
}

const DEFAULT_PLAYBOOK_PATH = path.join(
  "docs",
  "modules",
  "attraction",
  "playbook",
  "playbook-ki.html"
);

function defaultPlaybookPathCandidates(htmlPath?: string) {
  if (htmlPath) {
    return [htmlPath];
  }

  return [
    path.join(process.cwd(), DEFAULT_PLAYBOOK_PATH),
    path.join(process.cwd(), "..", "..", DEFAULT_PLAYBOOK_PATH)
  ];
}

async function readDefaultPlaybookHtml(htmlPath?: string) {
  let lastError: unknown = null;

  for (const candidate of defaultPlaybookPathCandidates(htmlPath)) {
    try {
      return await readFile(path.resolve(candidate), "utf8");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripTags(html: string) {
  return compactWhitespace(decodeHtmlEntities(html.replace(/<[^>]*>/g, " ")));
}

function normalizeQuery(query: string) {
  const normalizedQuery = compactWhitespace(query).toLocaleLowerCase("ru-RU");
  if (!normalizedQuery) {
    throw new PlaybookReaderError("INVALID_INPUT", "Search query is required.");
  }
  return normalizedQuery;
}

function clampLimit(input: {
  limit?: number | undefined;
  defaultLimit: number;
  maxLimit: number;
}) {
  if (input.limit === undefined) {
    return input.defaultLimit;
  }
  if (!Number.isInteger(input.limit) || input.limit <= 0) {
    throw new PlaybookReaderError("INVALID_INPUT", "Search limit must be positive.");
  }
  return Math.min(input.limit, input.maxLimit);
}

function snippetFor(input: { text: string; query: string }) {
  const text = input.text;
  const lowerText = text.toLocaleLowerCase("ru-RU");
  const index = lowerText.indexOf(input.query);
  if (index === -1) {
    return text.slice(0, 220);
  }
  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, index + input.query.length + 150);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${
    end < text.length ? "..." : ""
  }`;
}

function parseTabs(html: string) {
  const labelsById = new Map<string, string>();
  const tabPattern =
    /<button\b[^>]*class="[^"]*\btab\b[^"]*"[^>]*data-t="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g;
  let tabMatch: RegExpExecArray | null = null;

  while ((tabMatch = tabPattern.exec(html)) !== null) {
    const sectionId = tabMatch[1];
    const labelHtml = tabMatch[2];
    if (sectionId && labelHtml !== undefined) {
      labelsById.set(sectionId, stripTags(labelHtml));
    }
  }

  return labelsById;
}

export function parsePlaybookSections(html: string): PlaybookSection[] {
  const labelsById = parseTabs(html);
  const sectionPattern =
    /<section\b[^>]*class="[^"]*\bpanel\b[^"]*"[^>]*id="([^"]+)"[^>]*>([\s\S]*?)(?=<section\b[^>]*class="[^"]*\bpanel\b|<div\s+class="foot"|<script\b|<\/body>)/g;
  const sectionsById = new Map<string, PlaybookSection>();
  let sectionMatch: RegExpExecArray | null = null;

  while ((sectionMatch = sectionPattern.exec(html)) !== null) {
    const sectionId = sectionMatch[1];
    const sectionHtml = sectionMatch[2]?.trim();
    if (sectionId && sectionHtml !== undefined) {
      sectionsById.set(sectionId, {
        sectionId,
        label: labelsById.get(sectionId) ?? sectionId,
        html: sectionHtml,
        text: stripTags(sectionHtml)
      });
    }
  }

  const orderedSections = [...labelsById.keys()]
    .map((sectionId) => sectionsById.get(sectionId))
    .filter((section): section is PlaybookSection => section !== undefined);

  const unlabeledSections = [...sectionsById.values()].filter(
    (section) => !labelsById.has(section.sectionId)
  );

  return [...orderedSections, ...unlabeledSections];
}

export function createPlaybookReader(
  input: CreatePlaybookReaderInput = {}
): PlaybookReader {
  const defaultLimit = input.defaultLimit ?? 5;
  const maxLimit = input.maxLimit ?? 20;
  const readHtml =
    input.readHtml ?? (() => readDefaultPlaybookHtml(input.htmlPath));

  async function listSections() {
    return parsePlaybookSections(await readHtml());
  }

  return {
    listSections,
    async readSection({ sectionId }) {
      const section = (await listSections()).find(
        (candidate) => candidate.sectionId === sectionId
      );

      if (!section) {
        throw new PlaybookReaderError(
          "PLAYBOOK_SECTION_NOT_FOUND",
          `Playbook section ${sectionId} was not found.`
        );
      }

      return section;
    },
    async search({ query, limit }) {
      const normalizedQuery = normalizeQuery(query);
      const effectiveLimit = clampLimit({
        ...(limit === undefined ? {} : { limit }),
        defaultLimit,
        maxLimit
      });
      const results = (await listSections())
        .filter((section) =>
          `${section.label} ${section.text}`
            .toLocaleLowerCase("ru-RU")
            .includes(normalizedQuery)
        )
        .slice(0, effectiveLimit)
        .map((section) => ({
          sectionId: section.sectionId,
          label: section.label,
          snippet: snippetFor({
            text: section.text,
            query: normalizedQuery
          })
        }));

      return {
        query: normalizedQuery,
        results
      };
    }
  };
}

export async function readPlaybookSections() {
  return createPlaybookReader().listSections();
}
