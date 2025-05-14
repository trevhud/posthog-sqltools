import { IBaseQueries, NSDatabase, ContextValue } from "@sqltools/types";

// For PostHog, these queries are mostly stubs as schema is dynamic or non-existent.
// Returning dummy SQL strings to satisfy QueryBuilder type.
// AbstractDriver will pass these to our driver's query() method.

const queries: IBaseQueries = {
  fetchTables: (params?: NSDatabase.ISchema & { connId?: string }) => {
    // console.log("IBaseQueries.fetchTables for schema:", params?.label);
    return `SELECT name AS label, 'table' AS type, '${
      params?.label || "default"
    }' as schema FROM INFORMATION_SCHEMA.TABLES WHERE table_schema = '${
      params?.label || "default"
    }';`;
  },

  fetchColumns: (params?: NSDatabase.ITable & { connId?: string }) => {
    // console.log("IBaseQueries.fetchColumns for table:", params?.label);
    return `SELECT column_name AS label, data_type AS dataType, '${ContextValue.COLUMN}' as type FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = '${params?.label}';`;
  },

  fetchRecords: (params?: {
    limit: number;
    offset: number;
    table: NSDatabase.ITable;
    connId?: string;
  }) => {
    // console.log("IBaseQueries.fetchRecords for table:", params?.table?.label);
    return `SELECT * FROM ${params?.table?.label} LIMIT ${
      params?.limit || 50
    } OFFSET ${params?.offset || 0};`;
  },

  countRecords: (params?: { table: NSDatabase.ITable; connId?: string }) => {
    // console.log("IBaseQueries.countRecords for table:", params?.table?.label);
    return `SELECT COUNT(1) AS total FROM ${params?.table?.label};`;
  },

  // Optional members can be added if specific functionality is desired or if AbstractDriver requires them.
  // Example for fetchDatabases:
  // fetchDatabases: (params?: NSDatabase.IConnection & { connId?: string }) => {
  //   return `SELECT datname AS label, '${ContextValue.DATABASE}' AS type FROM pg_database;`;
  // },

  searchTables: (params?: {
    search: string;
    connId?: string;
    database?: string;
    schema?: string;
  }) => {
    return `SELECT table_name AS label, '${
      ContextValue.TABLE
    }' as type FROM INFORMATION_SCHEMA.TABLES WHERE table_name LIKE '%${params?.search?.replace(
      /'/g,
      "''"
    )}%';`;
  },

  searchColumns: (params?: {
    search: string;
    tables?: NSDatabase.ITable[];
    connId?: string;
    database?: string;
    schema?: string;
  }) => {
    const tableNames = params?.tables
      ?.map((t) => `'${t.label.replace(/'/g, "''")}'`)
      .join(",");
    return `SELECT column_name AS label, '${
      ContextValue.COLUMN
    }' as type FROM INFORMATION_SCHEMA.COLUMNS WHERE column_name LIKE '%${params?.search?.replace(
      /'/g,
      "''"
    )}%' AND table_name IN (${tableNames || "''"});`;
  },

  describeTable: (params?: NSDatabase.ITable & { connId?: string }) => {
    // A generic describe might not work well with HogQL.
    // This is a placeholder. The driver's own describeTable method might be more appropriate if called.
    return `SELECT column_name, data_type FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = '${params?.label?.replace(
      /'/g,
      "''"
    )}';`;
  },
};

export default queries;
