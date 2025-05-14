# PostHog ClickHouse Query Runner

A VSCode extension that allows you to run ClickHouse SQL queries against your PostHog database with a simple keyboard shortcut (Command+Enter).

## Features

- Store your ClickHouse queries as SQL files
- Run queries with Command+Enter
- View results in a nicely formatted panel
- Secure API key storage

## Setup

### Prerequisites

- Python 3.8+
- VSCode 1.60+
- PostHog API key

### Installation

1.  **Python Dependencies**:

    - The recommended way to install Python dependencies is by running the setup script:
      - Execute `python3 setup.py` or `./install.sh` (which runs `setup.py`). This will install dependencies from `requirements.txt`.
    - Alternatively, if you prefer to manage dependencies manually or are not using the setup script, ensure you have the required packages:
      ```bash
      pip install python-dotenv requests
      ```

2.  **API Key**:
    - Your PostHog API key is primarily managed via a `.env` file in the project root, or through the VSCode extension settings.
    - The `setup.py` script will prompt you to create a `.env` file if it doesn't exist. You can also create/edit it manually:

```
POSTHOG_API_KEY=your_api_key_here
```

3.  **Install the VSCode Extension**:
    - Open VSCode
    - Navigate to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X)

- Click on the "..." menu in the Extensions view
- Select "Install from VSIX..."
- Navigate to the `posthog/extension` directory and select the VSIX file (if you've packaged it)

Alternatively, you can use the extension in development mode:

- Open the `posthog/extension` folder in VSCode
- Press F5 to start debugging, which will launch a new VSCode window with the extension loaded

## Usage

1. Create SQL query files in the `posthog/queries` directory with a `.sql` extension
2. Open a query file in VSCode
3. Press Command+Enter to execute the query
4. View the results in the panel that appears

## Example Queries

Create a file `posthog/queries/example_query.sql` with the following content:

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

Open this file and press Command+Enter to see the top 10 events from the last day.

## Troubleshooting

- **Error: No active editor found**: Make sure you have a SQL file open and active in the editor.
- **Error: This command only works with SQL files in the posthog/queries directory**: Ensure your SQL files are saved in the `posthog/queries` directory and have a `.sql` extension.
- **Error executing query**: Check that your PostHog API key is correct and that your query syntax is valid.

## Development

### Project Structure

```
posthog/
├── .env                      # API key storage
├── .gitignore                # Git ignore file
├── README.md                 # This file
├── backend/                  # Python backend
│   ├── posthog_client.py     # PostHog API client
│   ├── query_executor.py     # Query execution logic
│   └── result_formatter.py   # Results formatting
├── extension/                # VSCode extension
│   ├── package.json          # Extension metadata
│   └── extension.js          # Extension code
└── queries/                  # Directory for SQL queries
    └── example_query.sql     # Example query
```

### Building the Extension

To package the extension for distribution:

```bash
cd posthog/extension
npm install
npm run package
```

This will create a VSIX file that can be installed in VSCode.
