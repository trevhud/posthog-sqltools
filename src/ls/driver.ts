import AbstractDriver from "@sqltools/base-driver";
import {
  IConnectionDriver,
  IQueryOptions,
  NSDatabase,
  MConnectionExplorer,
  ContextValue,
  Arg0,
  IConnection,
} from "@sqltools/types";
import { v4 as generateUuid } from "uuid";
import {
  PostHogClient,
  PostHogQueryResponse,
  RefreshStrategy,
} from "../lib/posthogClient"; // Adjusted path
import queries from "./queries";

// Define the structure of options PostHogClient constructor expects,
// which will be derived from IConnection credentials.
type PostHogClientLibOptions = {
  apiKey: string;
  projectId: string;
  userWorkspaceRoot?: string; // Will likely be undefined in SQLTools context
  customApiUrl?: string;
};

// Helper to transform PostHog results to SQLTools format
function transformResults(phResponse: PostHogQueryResponse): object[] {
  if (!phResponse.results || !phResponse.columns) {
    return [];
  }
  const results: object[] = [];
  const columns = phResponse.columns;
  phResponse.results.forEach((rowArray) => {
    const rowObj: { [key: string]: any } = {};
    columns.forEach((colName, index) => {
      rowObj[colName] = rowArray[index];
    });
    results.push(rowObj);
  });
  return results;
}

// User-defined type guard
function isConnectionItem(
  item: NSDatabase.SearchableItem | IConnection<any>
): item is IConnection<any> {
  return (
    item.type === ContextValue.CONNECTION ||
    item.type === ContextValue.CONNECTED_CONNECTION
  );
}

export default class PostHogDriver extends AbstractDriver<
  PostHogClient,
  PostHogClientLibOptions
> {
  public queries = queries;
  // No need for 'deps' array if PostHogClient and axios are bundled with the extension.

  // The constructor of AbstractDriver takes the connection object (this.credentials)
  // and establishes it. We don't need a separate constructor here unless for specific init.

  public async open(): Promise<PostHogClient> {
    if (this.connection) {
      // If a connection promise already exists, return it.
      return this.connection;
    }

    // Create and store the connection promise.
    // This IIFE creates a promise that resolves with the PostHogClient or rejects.
    this.connection = (async (): Promise<PostHogClient> => {
      if (!this.credentials) {
        throw new Error(
          "PostHog driver: Credentials not set before open call."
        );
      }

      const apiKey = this.credentials.posthogApiKey as string;
      const projectId = this.credentials.posthogProjectId as string;
      const apiUrl = this.credentials.posthogApiUrl as string | undefined;

      if (!apiKey || !projectId) {
        throw new Error("PostHog API Key and Project ID are required.");
      }

      const client = new PostHogClient(apiKey, projectId, undefined, apiUrl);

      try {
        await client.executeQuery("SELECT 1"); // Test query
        console.log(
          `PostHog driver: Connection ${this.credentials.id} established.`
        );
        return client; // Resolve the promise with the client
      } catch (error: any) {
        // If connection fails, the promise assigned to this.connection will be rejected.
        // No need to reassign this.connection here.
        console.error(
          `PostHog driver: Connection test failed for ${this.credentials.id}:`,
          error
        );
        throw new Error(
          `PostHog connection failed: ${error.message || String(error)}`
        );
      }
    })();

    return this.connection;
  }

  public async close(): Promise<void> {
    if (this.connection) {
      try {
        // Await the connection promise to ensure any pending connection logic is done.
        await this.connection; // Ensure the promise is settled before clearing
        console.log(
          `PostHog driver: Connection ${this.credentials.id} closed.`
        );
      } catch (error) {
        // Log error if the connection promise itself was rejected
        console.warn(
          `PostHog driver: Error during close while awaiting connection for ${this.credentials.id}: ${error}`
        );
      } finally {
        // Reset the connection promise. This allows open() to create a new one next time.
        (this.connection as any) = null;
      }
    }
  }

  public async query(
    query: string,
    opt: IQueryOptions = {}
  ): Promise<NSDatabase.IResult[]> {
    if (!this.connection) {
      console.warn(
        "PostHog driver: query called without existing connection promise, attempting to open."
      );
      await this.open();
      if (!this.connection) {
        throw new Error(
          "PostHog driver: Connection could not be established for query."
        );
      }
    }

    const client = await this.connection;

    if (!client) {
      throw new Error(
        "PostHog driver: Client not available after awaiting connection."
      );
    }

    try {
      const refreshStrategy: RefreshStrategy =
        (opt as any).refreshStrategy || "force_blocking";
      const phResponse = await client.executeQuery(query, refreshStrategy);

      const messages: (string | { message: string; date: Date })[] = [];
      if (phResponse.execution_time !== undefined) {
        messages.push(
          `Execution time: ${phResponse.execution_time.toFixed(3)}s`
        );
      }
      if (phResponse.results) {
        messages.push(`Fetched ${phResponse.results.length} rows.`);
      }
      if (phResponse.hogql) {
        messages.push(`HogQL: ${phResponse.hogql}`);
      }

      const result: NSDatabase.IResult = {
        connId: this.credentials.id,
        requestId: opt.requestId ?? "Unknown",
        resultId: generateUuid(),
        query: query,
        cols: phResponse.columns || [],
        results: transformResults(phResponse),
        error: !phResponse.success,
        rawError: phResponse.success
          ? undefined
          : new Error(
              phResponse.error || phResponse.detail || "Query execution failed"
            ),
        messages: messages,
      };
      return [result];
    } catch (error: any) {
      console.error(
        `PostHog driver: Error executing query for ${this.credentials.id}:`,
        error
      );
      const result: NSDatabase.IResult = {
        connId: this.credentials.id,
        requestId: opt.requestId ?? "Unknown",
        resultId: generateUuid(),
        query: query,
        cols: [],
        results: [],
        error: true,
        rawError: new Error(error.message || String(error)),
        messages: [error.message || String(error)],
      };
      return [result];
    }
  }

  public async testConnection(): Promise<void> {
    await this.open();
    await this.close();
  }

  public async getChildrenForItem({
    item,
  }: Arg0<IConnectionDriver["getChildrenForItem"]>) {
    if (isConnectionItem(item)) {
      // Using the type guard
      // item is now IConnection<any> due to isConnectionItem guard
      // IConnection.name is string, so databaseName will be string.
      const databaseName: string = item.name;
      const commonTables: MConnectionExplorer.IChildItem[] = [
        {
          label: "events",
          type: ContextValue.TABLE,
          iconId: "symbol-event",
          database: databaseName as any, // Force cast
          schema: "",
        },
        {
          label: "persons",
          type: ContextValue.TABLE,
          iconId: "account",
          database: databaseName as any, // Force cast
          schema: "",
        },
      ];
      return commonTables;
    } else if (item.type === ContextValue.TABLE) {
      // If item is a table, return no children (columns) for now
      return [];
    }
    // Potentially handle other item types like resource groups if we add them
    return [];
  }

  // Stubs for other IConnectionDriver methods
  public async describeTable(
    table: NSDatabase.ITable,
    opt?: IQueryOptions
  ): Promise<NSDatabase.IResult[]> {
    const result: NSDatabase.IResult = {
      connId: this.credentials.id,
      requestId: opt?.requestId || "",
      resultId: generateUuid(),
      query: `DESCRIBE ${table.label}`,
      cols: ["column_name", "data_type", "is_nullable"],
      results: [],
      messages: [
        `Schema information for '${table.label}' is not available via HogQL API.`,
      ],
      error: false,
    };
    return [result];
  }

  public async fetchColumns(
    table: NSDatabase.ITable,
    opt?: IQueryOptions
  ): Promise<NSDatabase.IResult[]> {
    const result: NSDatabase.IResult = {
      connId: this.credentials.id,
      requestId: opt?.requestId || "",
      resultId: generateUuid(),
      query: `COLUMNS FOR ${table.label}`,
      cols: ["column_name", "data_type"],
      results: [],
      messages: [
        `Column information for '${table.label}' is not available via HogQL API.`,
      ],
      error: false,
    };
    return [result];
  }

  public async showRecords(
    table: NSDatabase.ITable,
    opt: IQueryOptions & { limit: number; page?: number }
  ): Promise<NSDatabase.IResult[]> {
    const query = `SELECT * FROM ${table.label} LIMIT ${opt.limit || 50}`;
    return this.query(query, opt);
  }

  public async searchItems(
    itemType: ContextValue,
    search: string
  ): Promise<NSDatabase.SearchableItem[]> {
    if (itemType === ContextValue.TABLE) {
      const pseudoTables = ["events", "persons"];
      return pseudoTables
        .filter((t) => t.includes(search.toLowerCase()))
        .map(
          (t): NSDatabase.ITable => ({
            // Explicitly type the returned object as ITable
            label: t,
            type: ContextValue.TABLE,
            // IConnection.name is string, this.credentials should be valid here.
            database: this.credentials.name as any, // Force cast
            isView: false, // Added missing property
            schema: "", // Added missing property
          })
        );
    }
    return [];
  }

  public async getStaticCompletions(): Promise<
    Record<string, NSDatabase.IStaticCompletion>
  > {
    return {};
  }
}
