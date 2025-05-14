import { PostHogQueryResponse } from "./posthogClient";

export class ResultFormatter {
  private static escapeHtml(unsafe: string): string {
    if (unsafe === null || typeof unsafe === "undefined") return "";
    return String(unsafe)
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, '"')
      .replace(/'/g, "&#039;");
  }

  public static formatAsHtml(result: PostHogQueryResponse): string {
    if (!result.success) {
      return ResultFormatter._format_error_as_html(result);
    }

    try {
      const queryTextFromApi = ResultFormatter.escapeHtml(
        result.hogql || result.query || ""
      );
      const apiResults = result.results || [];
      const apiColumns = result.columns || [];
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
        now.getHours()
      ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(
        now.getSeconds()
      ).padStart(2, "0")}`;

      let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>PostHog Query Results</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                  line-height: 1.6;
                  color: var(--vscode-editor-foreground);
                  background-color: var(--vscode-editor-background);
                  padding: 20px;
                  margin: 0;
              }
              .query-info {
                  margin-bottom: 20px;
                  padding: 10px;
                  background-color: var(--vscode-editor-lineHighlightBackground);
                  border-radius: 4px;
              }
              .query-text {
                  font-family: 'Courier New', Courier, monospace;
                  white-space: pre-wrap;
                  padding: 10px;
                  background-color: var(--vscode-editor-inactiveSelectionBackground);
                  border-radius: 4px;
                  overflow-x: auto;
              }
              .timestamp {
                  font-size: 0.8em;
                  color: var(--vscode-descriptionForeground);
              }
              table {
                  border-collapse: collapse;
                  width: 100%;
                  margin-top: 20px;
                  overflow-x: auto;
                  display: block;
              }
              th, td {
                  text-align: left;
                  padding: 8px;
                  border: 1px solid var(--vscode-panel-border);
              }
              th {
                  background-color: var(--vscode-editor-lineHighlightBackground);
                  position: sticky;
                  top: 0;
              }
              tr:nth-child(even) {
                  background-color: var(--vscode-editor-inactiveSelectionBackground);
              }
              .json-value {
                  font-family: 'Courier New', Courier, monospace;
                  white-space: pre-wrap;
              }
              .stats {
                  margin-top: 10px;
                  font-size: 0.9em;
                  color: var(--vscode-descriptionForeground);
              }
              .no-results {
                  padding: 20px;
                  text-align: center;
                  color: var(--vscode-descriptionForeground);
              }
          </style>
      </head>
      <body>
          <div class="query-info">
              <div class="timestamp">Executed at: ${timestamp}</div>
              <h3>Query:</h3>
              <div class="query-text">${queryTextFromApi}</div>
          </div>
      `;

      if (apiResults.length > 0 && apiColumns.length > 0) {
        html += `
          <h3>Results:</h3>
          <div class="stats">Showing ${apiResults.length} rows</div>
          <table>
              <thead>
                  <tr>
        `;
        apiColumns.forEach((columnName) => {
          html += `<th>${ResultFormatter.escapeHtml(columnName)}</th>`;
        });
        html += `
                  </tr>
              </thead>
              <tbody>
        `;
        apiResults.forEach((rowValuesList) => {
          html += "<tr>";
          if (Array.isArray(rowValuesList)) {
            rowValuesList.forEach((value) => {
              let formattedValue: string;
              if (value === null || typeof value === "undefined") {
                formattedValue = "<em>NULL</em>";
              } else if (typeof value === "object") {
                const jsonStr = ResultFormatter.escapeHtml(
                  JSON.stringify(value, null, 2)
                );
                formattedValue = `<div class="json-value">${jsonStr}</div>`;
              } else {
                formattedValue = ResultFormatter.escapeHtml(String(value));
              }
              html += `<td>${formattedValue}</td>`;
            });
          } else {
            html += `<td colspan="${apiColumns.length}">Invalid row format</td>`;
          }
          html += "</tr>";
        });
        html += `
              </tbody>
          </table>
        `;
      } else if (result.success) {
        html += `
          <div class="no-results">
              <p>Query executed successfully, but returned no results or column information.</p>
          </div>
        `;
      } else {
        html +=
          "<p>An unexpected error occurred or no results were returned.</p>";
      }
      html += `
      </body>
      </html>
      `;
      return html;
    } catch (e: any) {
      return ResultFormatter._formatExceptionAsHtml(e, result);
    }
  }

  private static _format_error_as_html(result: PostHogQueryResponse): string {
    const errorMessage = ResultFormatter.escapeHtml(
      result.error || "Unknown error"
    );
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
      now.getHours()
    ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(
      now.getSeconds()
    ).padStart(2, "0")}`;

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); padding: 20px; }
            .error { color: var(--vscode-errorForeground); background-color: var(--vscode-inputValidation-errorBackground); padding: 10px; border-radius: 4px; margin-bottom: 20px; white-space: pre-wrap; }
            .timestamp { font-size: 0.8em; color: var(--vscode-descriptionForeground); }
        </style>
    </head>
    <body>
        <div class="timestamp">Executed at: ${timestamp}</div>
        <h2>Query Error</h2>
        <div class="error"><p>${errorMessage}</p></div>
    </body>
    </html>
    `;
  }

  private static _formatExceptionAsHtml(
    e: any,
    rawResult?: PostHogQueryResponse
  ): string {
    const errorMessage = ResultFormatter.escapeHtml(e.message || String(e));
    const rawResponseHtml = rawResult
      ? `<pre>${ResultFormatter.escapeHtml(
          JSON.stringify(rawResult, null, 2)
        )}</pre>`
      : "";
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); padding: 20px; }
            .error { color: var(--vscode-errorForeground); background-color: var(--vscode-inputValidation-errorBackground); padding: 10px; border-radius: 4px; margin-bottom: 20px; white-space: pre-wrap; }
        </style>
    </head>
    <body>
        <h2>Error Formatting Results</h2>
        <div class="error"><p>${errorMessage}</p></div>
        ${rawResult ? "<h3>Raw Response:</h3>" : ""}
        ${rawResponseHtml}
    </body>
    </html>
    `;
  }
}
