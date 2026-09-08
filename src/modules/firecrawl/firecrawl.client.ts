import FirecrawlApp from "@mendable/firecrawl-js";
import { firecrawlConfig } from "../../config/firecrawl.config";
import { systemConfigService } from "../system-config/system-config.service";

let cachedApiKey: string | null = null;
let cachedBaseUrl: string | null = null;
let firecrawlClient: FirecrawlApp | null = null;

export async function getDynamicFirecrawlClient(): Promise<FirecrawlApp> {
  const apiKey = await systemConfigService.get<string>(
    "integration.firecrawl.api_key",
    firecrawlConfig.apiKey,
  );
  const baseUrl = await systemConfigService.get<string>(
    "integration.firecrawl.base_url",
    firecrawlConfig.baseUrl,
  );

  const effectiveKey = apiKey || firecrawlConfig.apiKey;
  const effectiveUrl = baseUrl || firecrawlConfig.baseUrl;

  if (!effectiveKey) {
    throw new Error(
      "FIRECRAWL_API_KEY is not set. Add it in System Config or .env file before using the crawler.",
    );
  }

  if (
    !firecrawlClient ||
    cachedApiKey !== effectiveKey ||
    cachedBaseUrl !== effectiveUrl
  ) {
    cachedApiKey = effectiveKey;
    cachedBaseUrl = effectiveUrl;
    firecrawlClient = new FirecrawlApp({
      apiKey: effectiveKey,
      apiUrl: effectiveUrl,
    });
  }

  return firecrawlClient;
}

export function getFirecrawlClient(): FirecrawlApp {
  if (!firecrawlClient) {
    if (!firecrawlConfig.apiKey) {
      throw new Error(
        "FIRECRAWL_API_KEY is not set. Add it to your .env file before using the crawler.",
      );
    }

    firecrawlClient = new FirecrawlApp({
      apiKey: firecrawlConfig.apiKey,
      apiUrl: firecrawlConfig.baseUrl,
    });
  }
  return firecrawlClient;
}
