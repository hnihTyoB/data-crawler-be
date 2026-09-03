import FirecrawlApp from "@mendable/firecrawl-js";
import { firecrawlConfig } from "../../config/firecrawl.config";

let firecrawlClient: FirecrawlApp | null = null;

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
