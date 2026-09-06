// PD-SAAS-FORK VAP: crawler sidecar extract contract (AnyCrawl / Crawl4AI / Scrapling).

export type VapCrawlerEngine = "cheerio" | "playwright" | "stealth";

export type VapRenderExtractInput = {
  url: string;
  engine: VapCrawlerEngine;
  timeoutMs: number;
};

export type VapRenderExtractResult = {
  imageUrls: string[];
  finalUrl?: string;
  error?: string;
  skipped?: boolean;
};

export type VapRenderExtractClient = {
  extractImages(input: VapRenderExtractInput): Promise<VapRenderExtractResult>;
};
