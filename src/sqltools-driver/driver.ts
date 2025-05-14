import {
  IConnectionDriver,
  IConnection,
  IQueryOptions,
  NSDatabase,
  MConnectionExplorer, // For tree items if needed later
  // SQLToolsConnection, // Replaced by LSIConnection or not directly used by driver impl
  // ConnectionInterface, // Replaced by IConnection
  // ResponseResult, // Replaced by NSDatabase.IResult
  // FetchTablesRequest, // Methods might be different, e.g. describeTable, fetchColumns
  // FetchColumnsRequest,
} from "@sqltools/types";
import { PostHogClient, PostHogQueryResponse } from "../backend/posthogClient";
import { DRIVER_ID, DRIVER_NAME } from "./constants"; // Use DRIVER_ID for getId

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

// The IConnectionDriver interface requires a constructor signature.
// However, SQLTools typically instantiates the driver and then calls openConnection.
// We'll manage the PostHogClient instance within the driver, associated with a connection ID.
export default class PostHogDriver implements IConnectionDriver {
  // IConnectionDriver requires a `connection` property, but it's usually the underlying raw connection library.
  // For our API-based client, we'll store our PostHogClient instances.
  // This property might not be directly used if we manage client instances internally.
  public connection: any = null; // Placeholder, may need adjustment based on SQLTools usage.
  public credentials!: IConnection<any>; // SQLTools will set this before calling open

  private client: PostHogClient | null = null; // Store single client for this driver instance

  constructor() {
    // Empty constructor, SQLTools will set credentials and then call open.
  }

  // getId and getDisplayName are not part of IConnectionDriver, but good for identification if needed elsewhere.
  // SQLTools identifies drivers by their registration in package.json.
  // IConnectionDriver does not have getId() or getDisplayName().
  // These might be part of the object returned by activate(), or SQLTools uses the package.json registration.
  // The template's activate returns driverInstance.getId() and driverInstance.name for these.
  // Let's ensure our driver class can provide these if SQLTools queries the instance.
  // However, these are not part of IConnectionDriver.
  // For now, we rely on package.json `contributes` section for SQLTools to get name/ID.

  // open: Establishes a connection using details from SQLTools UI
  // Note: IConnectionDriver uses `open()` not `openConnection(connInfo)`.
  // The `credentials` passed to constructor (or set on instance) are used.
  public async open(): Promise<void> {
    if (!this.credentials) {
      throw new Error("PostHog driver: Credentials not set before open call.");
    }
    const connInfo = this.credentials;

    if (!connInfo.posthogApiKey || !connInfo.posthogProjectId) {
      throw new Error(
        "PostHog API Key and Project ID are required in connection settings."
      );
    }

    this.client = new PostHogClient(
      connInfo.posthogApiKey,
      connInfo.posthogProjectId,
      undefined, // userWorkspaceRoot - not applicable here
      connInfo.posthogApiUrl
    );

    try {
      const testQuery = await this.client.executeQuery("SELECT 1");
      if (!testQuery.success) {
        throw new Error(
          `Connection test failed: ${testQuery.error || "Unknown error"}`
        );
      }
      console.log(
        `PostHog driver: Connection ${connInfo.id} established successfully.`
      );
    } catch (error: any) {
      this.client = null; // Clear client on error
      console.error(`PostHog driver: Failed to connect ${connInfo.id}:`, error);
      throw new Error(
        `Failed to connect to PostHog: ${error.message || String(error)}`
      );
    }
  }

  // close: Closes the connection
  public async close(): Promise<void> {
    if (this.client) {
      this.client = null;
      console.log(`PostHog driver: Connection ${this.credentials.id} closed.`);
    }
  }

  // query: Executes a query
  public async query(
    query: string,
    opt?: IQueryOptions // opt.connId should match this.credentials.id
  ): Promise<NSDatabase.IResult[]> {
    if (!this.client) {
      throw new Error("PostHog driver: No active connection found.");
    }
    // Verify connId if provided in opt, though typically one driver instance per connection
    if (opt?.connId && opt.connId !== this.credentials.id) {
      throw new Error(
        `PostHog driver: Mismatched connId. Expected ${this.credentials.id}, got ${opt.connId}`
      );
    }

    try {
      const phResponse = await this.client.executeQuery(query);
      const messages: (string | { message: string; date: Date })[] = [];
      if (phResponse.execution_time !== undefined) {
        messages.push(
          `Execution time: ${phResponse.execution_time.toFixed(3)}s`
        );
      }
      if (phResponse.results) {
        messages.push(`Fetched ${phResponse.results.length} rows.`);
      }

      const result: NSDatabase.IResult = {
        connId: this.credentials.id,
        requestId: opt?.requestId || "",
        resultId: opt?.requestId || Date.now().toString(),
        query: query,
        cols: phResponse.columns || [],
        results: transformResults(phResponse),
        error: !phResponse.success,
        rawError: phResponse.success
          ? undefined
          : new Error(phResponse.error || "Query execution failed"),
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
        requestId: opt?.requestId || "",
        resultId: opt?.requestId || Date.now().toString(),
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

  // describeTable and fetchColumns are part of IConnectionDriver
  // For getTables, we might need to use getChildrenForItem or searchItems if we want to populate the explorer.
  // Let's implement describeTable and fetchColumns as stubs for now.

  public async describeTable(
    table: NSDatabase.ITable,
    opt?: IQueryOptions
  ): Promise<NSDatabase.IResult[]> {
    // This method is for describing a table structure, often used by SQLTools.
    // For HogQL, true schema discovery is hard. We can return minimal info or an informative message.
    const result: NSDatabase.IResult = {
      connId: this.credentials.id,
      requestId: opt?.requestId || "",
      resultId: opt?.requestId || Date.now().toString(),
      query: `DESCRIBE ${table.label}`, // Faux query
      cols: ["column_name", "data_type", "is_nullable"], // Example columns
      results: [], // No actual results for now
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
      resultId: opt?.requestId || Date.now().toString(),
      query: `COLUMNS FOR ${table.label}`, // Faux query
      cols: ["column_name", "data_type"],
      results: [],
      messages: [
        `Column information for '${table.label}' is not available via HogQL API.`,
      ],
      error: false,
    };
    return [result];
  }

  // testConnection is part of IConnectionDriver
  public async testConnection(): Promise<void> {
    // This method is usually called with the driver instance already having credentials.
    // It's similar to open() but shouldn't store the client globally if it's just a test.
    if (!this.credentials) {
      // Should not happen if SQLTools sets credentials before calling
      throw new Error(
        "PostHog driver: Credentials not set for testConnection."
      );
    }
    const testClient = new PostHogClient(
      this.credentials.posthogApiKey,
      this.credentials.posthogProjectId,
      undefined,
      this.credentials.posthogApiUrl
    );
    try {
      const testQuery = await testClient.executeQuery("SELECT 1");
      if (!testQuery.success) {
        throw new Error(
          `Connection test failed: ${testQuery.error || "Unknown error"}`
        );
      }
      console.log(
        `PostHog driver: Test connection for ${this.credentials.id} successful.`
      );
    } catch (error: any) {
      console.error(
        `PostHog driver: Test connection for ${this.credentials.id} failed:`,
        error
      );
      throw new Error(
        `PostHog connection test failed: ${error.message || String(error)}`
      );
    }
  }

  // Other IConnectionDriver methods (optional or stubs for now)
  public async showRecords(
    table: NSDatabase.ITable,
    opt: IQueryOptions & { limit: number; page?: number }
  ): Promise<NSDatabase.IResult[]> {
    // Implement if you want "Show Records" context menu in SQLTools explorer to work
    const query = `SELECT * FROM ${table.label} LIMIT ${opt.limit}`; // Basic example
    return this.query(query, opt);
  }

  public async checkDependencies?(): Promise<void> {
    /* Optional */
  }
  public async getChildrenForItem?(params: {
    item: NSDatabase.SearchableItem;
    parent?: NSDatabase.SearchableItem;
  }): Promise<MConnectionExplorer.IChildItem[]> {
    // This is key for populating the connection explorer tree.
    // For PostHog, we could return a static list of "tables" (events, persons) under the connection.
    if (
      params.item.type === ContextValue.CONNECTION ||
      params.item.type === ContextValue.CONNECTED_CONNECTION
    ) {
      const commonTables: MConnectionExplorer.IChildItem[] = [
        {
          label: "events",
          type: ContextValue.TABLE,
          iconId: "symbol-event",
          database: params.item.database,
          schema: "",
        },
        {
          label: "persons",
          type: ContextValue.TABLE,
          iconId: "account",
          database: params.item.database,
          schema: "",
        },
        // Add more pseudo-tables if desired
      ];
      return commonTables;
    }
    return []; // No children for tables/columns in this basic version
  }
  public async searchItems?(
    itemType: ContextValue,
    search: string,
    extraParams: any
  ): Promise<NSDatabase.SearchableItem[]> {
    return []; /* Optional */
  }
  public async getStaticCompletions?(): Promise<{
    [w: string]: NSDatabase.IStaticCompletion;
  }> {
    return {}; /* Optional */
  }
  public async getInsertQuery?(params: {
    item: NSDatabase.ITable;
    columns: Array<NSDatabase.IColumn>;
  }): Promise<string> {
    return ""; /* Optional */
  }
  // createSshTunnel is likely not relevant for an API-based driver.
}

// Need to define ContextValue if it's used and not automatically imported from @sqltools/types
// It seems MConnectionExplorer.IChildItem and NSDatabase.SearchableItem use it.
// Let's add a basic enum for it if it's not picked up from @sqltools/types.
// Check if @sqltools/types exports ContextValue. It does.
import { ContextValue } from "@sqltools/types";
