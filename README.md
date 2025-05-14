# PostHog ClickHouse Query Runner (TypeScript Version)

A VSCode extension that allows you to run ClickHouse SQL queries against your PostHog database with a simple keyboard shortcut (Command+Enter). This version is written in TypeScript.

## Features

- Store your ClickHouse queries as SQL files.
- Run queries with Command+Enter (or your configured shortcut).
- View results in a nicely formatted panel.
- Secure API key storage via `.env` file or VSCode settings.
- Entirely written in TypeScript, no Python dependency for the extension itself.

## Setup

### Prerequisites

- **Node.js**: LTS version (e.g., 18.x or 20.x) recommended, which includes npm.
- **VSCode**: Version `^1.60.0` or higher.
- **PostHog API Key & Project ID**: Required to connect to your PostHog instance.

### Installation & Configuration

1.  **Clone the Repository**:

    ```bash
    git clone <repository_url>
    cd posthog # Or your repository's root folder
    ```

2.  **Install Dependencies**:
    Install the Node.js dependencies for the extension.

    ```bash
    npm install
    ```

3.  **API Key & Project ID**:
    Your PostHog API Key and Project ID are primarily managed via a `.env` file in the project root, or through the VSCode extension settings.

    - Create or edit the `.env` file in the project root:
      ```env
      POSTHOG_API_KEY=your_api_key_here
      POSTHOG_PROJECT_ID=your_project_id_here
      ```
    - Alternatively, you can configure these in VSCode settings under "PostHog ClickHouse Query Runner". Values from VSCode settings take precedence over the `.env` file.

4.  **Build the Extension**:
    Compile the TypeScript code to JavaScript:
    ```bash
    npm run compile
    ```
    This will create an `out/` directory with the compiled JavaScript.

### Running the Extension

**Development Mode:**

1.  Open the project root folder (e.g., `posthog/`) in VSCode.
2.  Press `F5` to start debugging. This will launch a new VSCode Extension Development Host window with the extension loaded.

**Installing a Packaged VSIX (Optional):**

1.  Package the extension:
    ```bash
    npm run package
    ```
    This will create a `.vsix` file (e.g., `posthog-clickhouse-query-runner-0.1.0.vsix`) in the project root.
2.  In VSCode, navigate to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X).
3.  Click on the "..." menu in the Extensions view.
4.  Select "Install from VSIX..." and choose the generated `.vsix` file.

## Usage

1.  Create SQL query files (e.g., in the `queries/` directory or anywhere within your workspace) with a `.sql` extension.
2.  Open a query file in VSCode.
3.  Press `Cmd+Enter` (Mac) or `Ctrl+Enter` (Windows/Linux) to execute the query.
4.  View the results in the panel that appears.

## Example Queries

Create a file `queries/example_query.sql` with the following content:

```sql
SELECT
    event,
    count(*) as count
FROM events
WHERE timestamp > now() - INTERVAL 1 DAY
GROUP BY event
ORDER BY count DESC
LIMIT 10
```

Open this file and execute it to see the top 10 events from the last day.

## Troubleshooting

- **Error: No active editor found**: Make sure you have a SQL file open and active in the editor.
- **Error: Path validation failed... SQL files must be within your project**: Ensure your SQL files are located within the currently open VSCode workspace/folder.
- **Error executing query**:
  - Check that your PostHog API Key and Project ID are correct in your `.env` file or VSCode settings.
  - Verify your query syntax is valid HogQL/ClickHouse SQL.
  - Ensure network connectivity to your PostHog instance.

## Development

### Project Structure

The project is now structured as a TypeScript VSCode extension:

```
.
├── .env                      # API key and Project ID storage (gitignored)
├── .gitignore                # Git ignore file
├── README.md                 # This file
├── package.json              # Extension metadata, scripts, & dependencies
├── tsconfig.json             # TypeScript compiler configuration
├── src/                      # TypeScript source files
│   ├── extension.ts          # Main extension activation logic
│   └── backend/              # TypeScript backend modules
│       ├── posthogClient.ts    # Handles PostHog API communication
│       ├── queryExecutor.ts    # Core query execution logic
│       └── resultFormatter.ts  # Formats results to HTML
├── out/                      # Compiled JavaScript (generated, gitignored)
├── node_modules/             # Project dependencies (gitignored)
└── queries/                  # Example directory for SQL queries
    └── example_query.sql     # Example query
```

### Key Scripts (`package.json`)

- `npm run compile`: Compiles TypeScript to JavaScript (output to `out/`).
- `npm run watch`: Compiles TypeScript in watch mode.
- `npm run lint`: Lints the TypeScript source code (requires ESLint setup for TypeScript).
- `npm run package`: Packages the extension into a `.vsix` file for distribution.
- `npm install`: Installs dependencies.

(Note: The `setup.py` and `requirements.txt` files at the root may pertain to other Python components of a larger "posthog" project and are not directly used by this TypeScript-based VSCode extension.)
