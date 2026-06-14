/** Hand-written types mirroring contract/openapi.yaml. Parity-tested against
 *  contract/fixtures/cases.json so they never drift from the API. */

export type Country =
  | "br" | "us" | "gb" | "de" | "fr" | "es" | "it" | "mx" | "ca" | "au" | "jp" | "nl";

export type Tbs = "qdr:h" | "qdr:d" | "qdr:w";

export interface SearchParams {
  /** The search query (required). */
  q: string;
  /** Country (geolocation). Default "us". */
  gl?: Country;
  /** UI language, BCP-47-ish ("en", "pt-BR"). */
  hl?: string;
  /** Time filter — past hour/day/week. */
  tbs?: Tbs;
  /** 1-indexed page. Default 1. */
  page?: number;
}

export interface Sitelink {
  title: string;
  link: string;
}

export interface OrganicResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
  date?: string;
  sitelinks?: Sitelink[];
}

export interface Ad {
  position: number;
  title: string;
  link: string;
  displayedLink?: string;
  snippet?: string;
  block: string;
  sitelinks?: Sitelink[];
}

export interface RelatedSearch {
  query: string;
  link: string;
}

export interface KnowledgeGraph {
  title: string;
  imageUrl?: string;
  description?: string;
  descriptionSource?: string;
  descriptionLink?: string;
  attributes?: Record<string, string>;
}

export interface SearchStats {
  /** Credits remaining after this search. */
  balance: number;
  /** Credits charged (6 fresh / 3 cache hit). */
  cost: number;
  cached: boolean;
}

export interface SearchResponse {
  search: string;
  page: number;
  knowledgeGraph?: KnowledgeGraph;
  organic: OrganicResult[];
  ads?: Ad[];
  peopleAlsoAsk?: string[];
  relatedSearches?: RelatedSearch[];
  stats?: SearchStats;
}
