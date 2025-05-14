import axios, { AxiosInstance, AxiosError } from "axios";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Define refresh strategy types based on PostHog documentation
export type RefreshStrategy =
  | "force_cache" // Return cached data or a cache miss; always completes immediately
  | "blocking" // Calculate synchronously, unless there are very fresh results in the cache
  | "async" // Kick off background calculation, unless there are very fresh results in the cache
  | "lazy_async" // Kick off background calculation, unless there are somewhat fresh results in the cache
  | "force_blocking" // Calculate synchronously, even if fresh results are already cached
  | "force_async"; // Kick off background calculation, even if fresh results are already cached

export interface PostHogQueryResponse {
  results?: any[][];
  columns?: string[];
  hogql?: string;
  query?: string;
  error?: string;
  detail?: string;
  success?: boolean;
  raw_response?: any; // For storing the original response in case of API-reported error
  execution_time?: number; // Will be added by QueryExecutor
  file_path?: string; // Will be added by QueryExecutor
}

export class PostHogClient {
  private apiKey: string;
  private projectId: string;
  private baseUrl: string; // Will be set in constructor
  private httpClient: AxiosInstance;

  constructor(
    apiKey?: string,
    projectId?: string,
    userWorkspaceRoot?: string,
    customApiUrl?: string
  ) {
    // Load .env file from user's workspace if provided
    if (userWorkspaceRoot) {
      const envPath = path.join(userWorkspaceRoot, ".env");
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        console.log(`Loaded .env file from: ${envPath}`, "PostHogClient");
      } else {
        console.log(`.env file not found at: ${envPath}`, "PostHogClient");
      }
    } else {
      console.log(
        "userWorkspaceRoot not set for PostHogClient. .env loading might be unreliable.",
        "PostHogClient"
      );
    }

    // Order of precedence for API key:
    // 1. POSTHOG_API_KEY_VSCODE_CONFIG (from VSCode extension settings, passed via envVars in extension.ts)
    // 2. apiKey argument passed to constructor
    // 3. POSTHOG_API_KEY (from .env file or system environment)
    let resolvedApiKey = process.env["POSTHOG_API_KEY_VSCODE_CONFIG"];
    let sourceApiKey = "VSCode settings";

    if (!resolvedApiKey && apiKey) {
      resolvedApiKey = apiKey;
      sourceApiKey = "constructor argument";
    }
    if (!resolvedApiKey) {
      resolvedApiKey = process.env["POSTHOG_API_KEY"];
      sourceApiKey = ".env file or system environment";
    }

    if (resolvedApiKey) {
      this.apiKey = resolvedApiKey;
      console.log(`Using API key from ${sourceApiKey}.`, "PostHogClient");
    } else {
      throw new Error(
        "PostHog API key is required. Set POSTHOG_API_KEY_VSCODE_CONFIG (via extension), pass to constructor, or set POSTHOG_API_KEY in .env/environment."
      );
    }

    // Order of precedence for Project ID:
    // 1. POSTHOG_PROJECT_ID_VSCODE_CONFIG (from VSCode extension settings, passed via envVars in extension.ts)
    // 2. projectId argument passed to constructor
    // 3. POSTHOG_PROJECT_ID (from .env file or system environment)
    let resolvedProjectId = process.env["POSTHOG_PROJECT_ID_VSCODE_CONFIG"];
    let sourceProjectId = "VSCode settings";

    if (!resolvedProjectId && projectId) {
      resolvedProjectId = projectId;
      sourceProjectId = "constructor argument";
    }
    if (!resolvedProjectId) {
      resolvedProjectId = process.env["POSTHOG_PROJECT_ID"];
      sourceProjectId = ".env file or system environment";
    }

    if (resolvedProjectId) {
      this.projectId = resolvedProjectId;
      console.log(`Using Project ID from ${sourceProjectId}.`, "PostHogClient");
    } else {
      throw new Error(
        "PostHog Project ID is required. Set it in VSCode settings, .env file, or pass it to the constructor."
      );
    }

    // Set base URL
    let apiDomain = "https://us.posthog.com"; // Default domain
    if (customApiUrl) {
      // Remove trailing slash if any, to consistently add /api later
      apiDomain = customApiUrl.replace(/\/$/, "");
    }
    // Ensure the final baseUrl includes /api
    if (apiDomain.endsWith("/api")) {
      this.baseUrl = apiDomain;
    } else {
      this.baseUrl = `${apiDomain}/api`;
    }
    console.log(`Using API base URL: ${this.baseUrl}`, "PostHogClient");

    this.httpClient = axios.create({
      baseURL: this.baseUrl, // Now uses the dynamically set baseUrl
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
  }

  public async executeQuery(
    query: string,
    refresh: RefreshStrategy = "force_blocking"
  ): Promise<PostHogQueryResponse> {
    const endpoint = `/projects/${this.projectId}/query`;

    // Clean and flatten the SQL query (similar to Python version)
    let processedQuery = query.replace(/\/\*.*?\*\//gs, ""); // Remove block comments
    processedQuery = processedQuery.replace(/--.*?\n/g, "\n"); // Remove line comments
    processedQuery = processedQuery.replace(/--.*?$/g, ""); // For comment at end of file
    processedQuery = processedQuery.replace(/\s+/g, " ").trim(); // Replace newlines, multiple spaces with single space, trim

    if (processedQuery.endsWith(";")) {
      processedQuery = processedQuery.slice(0, -1);
    }
    const cleanQuery = processedQuery;

    const payload: any = {
      query: {
        kind: "HogQLQuery",
        query: cleanQuery,
      },
    };
    if (refresh) {
      payload.refresh = refresh;
    }

    try {
      const response = await this.httpClient.post(endpoint, payload);
      const apiResponseJson: PostHogQueryResponse = response.data;

      if (apiResponseJson.error != null) {
        // API itself reported an error
        const errorDetail =
          apiResponseJson.detail || String(apiResponseJson.error);
        return {
          error: `API Query Error: ${errorDetail}`,
          success: false,
          raw_response: apiResponseJson,
        };
      } else {
        apiResponseJson.success = true;
        return apiResponseJson;
      }
    } catch (error) {
      const axiosError = error as AxiosError<PostHogQueryResponse>;
      let errorMessage = `Request Error: ${axiosError.message}`;
      if (axiosError.response && axiosError.response.data) {
        const errorData = axiosError.response.data;
        if (errorData.detail) {
          errorMessage = `Error executing query: ${errorData.detail}`;
        } else if (errorData.error) {
          errorMessage = `Error executing query: ${errorData.error}`;
        }
        // Add more specific error parsing if needed, e.g. for array of errors
      }
      return {
        error: errorMessage,
        success: false,
      };
    }
  }
}
