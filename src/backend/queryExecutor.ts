import * as fs from "fs";
import * as path from "path";
import {
  PostHogClient,
  RefreshStrategy,
  PostHogQueryResponse,
} from "./posthogClient";
import { ResultFormatter } from "./resultFormatter";

export class QueryExecutor {
  private client: PostHogClient;
  private userWorkspaceRoot?: string;

  constructor(
    apiKey?: string,
    projectId?: string,
    userWorkspaceRoot?: string,
    customApiUrl?: string
  ) {
    this.userWorkspaceRoot = userWorkspaceRoot;
    this.client = new PostHogClient(
      apiKey,
      projectId,
      userWorkspaceRoot,
      customApiUrl
    );
  }

  public async executeQueryFromFile(
    filePath: string,
    refresh: RefreshStrategy = "blocking"
  ): Promise<PostHogQueryResponse> {
    try {
      const fullPath = path.resolve(filePath); // Ensure absolute path
      if (!fs.existsSync(fullPath)) {
        return {
          error: `File not found: ${fullPath}`,
          success: false,
        };
      }

      const query = fs.readFileSync(fullPath, "utf8").trim();
      if (!query) {
        return {
          error: "Query file is empty",
          success: false,
        };
      }

      const startTime = Date.now();
      const result = await this.client.executeQuery(query, refresh);
      const executionTime = (Date.now() - startTime) / 1000; // in seconds

      result.execution_time = executionTime;
      result.file_path = filePath;
      // 'success' flag is set by PostHogClient

      return result;
    } catch (e: any) {
      return {
        error: `Error executing query from file: ${e.message || String(e)}`,
        success: false,
      };
    }
  }

  public async executeQuery(
    query: string,
    refresh: RefreshStrategy = "blocking"
  ): Promise<PostHogQueryResponse> {
    try {
      const startTime = Date.now();
      const result = await this.client.executeQuery(query, refresh);
      const executionTime = (Date.now() - startTime) / 1000; // in seconds

      result.execution_time = executionTime;
      // 'success' flag is set by PostHogClient

      return result;
    } catch (e: any) {
      return {
        error: `Error executing query: ${e.message || String(e)}`,
        success: false,
      };
    }
  }

  public formatResultsAsHtml(result: PostHogQueryResponse): string {
    // This will call the static method on ResultFormatter
    return ResultFormatter.formatAsHtml(result);
  }
}
