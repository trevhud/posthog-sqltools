import * as vscode from "vscode";
// import { spawn, ChildProcess } from "child_process"; // No longer needed
import * as path from "path";
// import * as fs from "fs"; // No longer directly used in this file
import { QueryExecutor } from "./backend/queryExecutor";
import { PostHogQueryResponse } from "./backend/posthogClient";

/**
 * @param {vscode.ExtensionContext} context
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("PostHog ClickHouse Query Runner is now active");

  // Register the command to run a query
  let disposable = vscode.commands.registerCommand(
    "posthog-clickhouse-query-runner.runQuery",
    async function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found");
        return;
      }

      const filePath = editor.document.uri.fsPath;
      const normalizedFilePath = path.normalize(filePath);

      // Determine the user's workspace root for validating SQL file location
      let userWorkspaceRoot;
      if (
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0
      ) {
        userWorkspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      } else {
        // If no workspace is open, we cannot reliably determine the project root for 'queries'
        vscode.window.showErrorMessage(
          "Please open a folder or workspace to use this extension."
        );
        return;
      }
      const normalizedUserWorkspaceRoot = path.normalize(userWorkspaceRoot);

      // Check if the file is a .sql file
      if (!filePath.endsWith(".sql")) {
        vscode.window.showInformationMessage(
          "This command only works with .sql files."
        );
        return;
      }

      // Check if the file is within the user's workspace root
      const relativePath = path.relative(
        normalizedUserWorkspaceRoot,
        normalizedFilePath
      );
      if (relativePath.startsWith("..")) {
        const errorMsg = `Path validation failed. WorkspaceRoot: [${normalizedUserWorkspaceRoot}], FilePath: [${normalizedFilePath}], RelativePath: [${relativePath}]. SQL files must be within your project (relative to the workspace root).`;
        console.log(errorMsg); // Keep console log for dev mode
        vscode.window.showInformationMessage(errorMsg);
        return;
      }

      try {
        // Save the document if it has unsaved changes
        if (editor.document.isDirty) {
          await editor.document.save();
        }

        // Show a progress notification
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Running PostHog ClickHouse Query",
            cancellable: false,
          },
          async (
            progress: vscode.Progress<{ message?: string; increment?: number }>
          ) => {
            progress.report({ message: "Executing query..." });

            try {
              const config = vscode.workspace.getConfiguration(
                "posthogClickhouseQueryRunner"
              );
              const configuredApiKey = config.get<string>("apiKey");
              const configuredProjectId = config.get<string>("projectId");

              // Instantiate the TypeScript QueryExecutor
              // Pass workspace root for .env loading, and API key/project ID if configured
              const queryExecutor = new QueryExecutor(
                configuredApiKey,
                configuredProjectId,
                normalizedUserWorkspaceRoot
              );

              // Execute the query using the TypeScript backend
              const result: PostHogQueryResponse =
                await queryExecutor.executeQueryFromFile(normalizedFilePath);

              // Format results as HTML using the TypeScript backend
              const htmlContent: string =
                queryExecutor.formatResultsAsHtml(result);

              // Create and show the webview panel
              const panel = vscode.window.createWebviewPanel(
                "posthogQueryResult",
                "PostHog Query Result",
                vscode.ViewColumn.Beside,
                {
                  enableScripts: true,
                  // localResourceRoots is not strictly necessary if HTML is self-contained
                  // and doesn't load local files from a specific path.
                  // For simplicity, we can remove it if the generated HTML is fully self-contained.
                  // If specific local files (e.g. images from extension path) were needed,
                  // it would be: localResourceRoots: [vscode.Uri.file(context.extensionPath)]
                }
              );

              panel.webview.html = htmlContent;

              // No temporary files to clean up with the new TypeScript backend approach
            } catch (error: any) {
              vscode.window.showErrorMessage(
                `Error executing query: ${error.message || String(error)}`
              );
              // No explicit throw error needed here as withProgress handles it
            }
          }
        );
      } catch (error: any) {
        // This catch is for errors outside withProgress, e.g., editor.document.save()
        vscode.window.showErrorMessage(
          `Error: ${error.message || String(error)}`
        );
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
