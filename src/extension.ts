import * as vscode from "vscode";
import * as path from "path";
import { QueryExecutor } from "./lib/queryExecutor"; // For standalone command
import { PostHogQueryResponse } from "./lib/posthogClient"; // For standalone command
import {
  IExtension,
  IExtensionPlugin,
  IDriverExtensionApi,
} from "@sqltools/types";
import { DRIVER_ALIASES } from "./constants"; // New constants path

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { publisher, name, displayName } = require("../package.json"); // Get details from package.json

export async function activate(
  context: vscode.ExtensionContext
): Promise<IDriverExtensionApi> {
  console.log(`${displayName} is now active!`);

  // ===== Register the standalone command to run a query =====
  const runQueryCommand = vscode.commands.registerCommand(
    "posthog-sqltools.runQuery",
    async function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found");
        return;
      }

      const filePath = editor.document.uri.fsPath;
      const normalizedFilePath = path.normalize(filePath);

      let userWorkspaceRoot: string | undefined;
      if (
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0
      ) {
        userWorkspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      } else {
        vscode.window.showErrorMessage(
          "Please open a folder or workspace to use the standalone query runner."
        );
        return;
      }
      const normalizedUserWorkspaceRoot = path.normalize(userWorkspaceRoot);

      if (!filePath.endsWith(".sql")) {
        vscode.window.showInformationMessage(
          "This command only works with .sql files."
        );
        return;
      }

      const relativePath = path.relative(
        normalizedUserWorkspaceRoot,
        normalizedFilePath
      );
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        const errorMsg = `Path validation failed. SQL files must be within your project.`;
        console.log(errorMsg, {
          normalizedUserWorkspaceRoot,
          normalizedFilePath,
          relativePath,
        });
        vscode.window.showInformationMessage(errorMsg);
        return;
      }

      try {
        if (editor.document.isDirty) {
          await editor.document.save();
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Running PostHog Query",
            cancellable: false,
          },
          async () => {
            try {
              const config = vscode.workspace.getConfiguration(
                "posthogSqltools" // Ensure this matches your configuration section in package.json
              );
              const configuredApiKey = config.get<string>("apiKey");
              const configuredProjectId = config.get<string>("projectId");

              const queryExecutor = new QueryExecutor(
                configuredApiKey,
                configuredProjectId,
                normalizedUserWorkspaceRoot
              );

              const result: PostHogQueryResponse =
                await queryExecutor.executeQueryFromFile(normalizedFilePath);

              const htmlContent: string =
                queryExecutor.formatResultsAsHtml(result);

              const panel = vscode.window.createWebviewPanel(
                "posthogQueryResult",
                "PostHog Query Result",
                vscode.ViewColumn.Beside,
                { enableScripts: true }
              );
              panel.webview.html = htmlContent;
            } catch (error: any) {
              vscode.window.showErrorMessage(
                `Error executing query: ${error.message || String(error)}`
              );
            }
          }
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Error: ${error.message || String(error)}`
        );
      }
    }
  );
  context.subscriptions.push(runQueryCommand);

  // ===== SQLTools Driver Plugin Registration =====
  try {
    const sqltools =
      vscode.extensions.getExtension<IExtension>("mtxr.sqltools");
    if (!sqltools) {
      vscode.window.showWarningMessage(
        "SQLTools extension is not installed. PostHog SQLTools driver will not be available."
      );
      // Return a compliant but non-functional API if SQLTools is not present
      return {
        driverName: `${displayName} (SQLTools not found)`,
        driverAliases: DRIVER_ALIASES,
      };
    }
    await sqltools.activate();
    const api = sqltools.exports;

    const extensionId = `${publisher}.${name}`;
    const plugin: IExtensionPlugin = {
      extensionId,
      name: `${displayName} SQLTools Driver`,
      type: "driver",
      async register(extension) {
        // Register resources
        if (
          DRIVER_ALIASES &&
          DRIVER_ALIASES.length > 0 &&
          DRIVER_ALIASES[0].value
        ) {
          const driverValue = DRIVER_ALIASES[0].value; // Use the 'value' from constants for mapping
          extension.resourcesMap().set(`driver/${driverValue}/icons`, {
            active: context.asAbsolutePath("icons/posthog-active.png"),
            default: context.asAbsolutePath("icons/posthog-default.png"),
            inactive: context.asAbsolutePath("icons/posthog-inactive.png"),
          });
          extension
            .resourcesMap()
            .set(
              `driver/${driverValue}/connection-schema`,
              context.asAbsolutePath("connection.schema.json")
            );
          extension
            .resourcesMap()
            .set(
              `driver/${driverValue}/ui-schema`,
              context.asAbsolutePath("ui.schema.json")
            );
        } else {
          console.error(
            "DRIVER_ALIASES is not correctly defined in constants.ts for resource mapping."
          );
        }

        // Register Language Server plugin
        // Path should be to the compiled JS file in 'out' directory
        await extension.client.sendRequest("ls/RegisterPlugin", {
          path: context.asAbsolutePath("out/ls/plugin.js"),
        });
      },
    };
    api.registerPlugin(plugin);

    return {
      driverName: displayName, // This is the main display name from package.json
      parseBeforeSaveConnection: ({ connInfo }) => connInfo, // Optional: transform connInfo before saving
      parseBeforeEditConnection: ({ connInfo }) => connInfo, // Optional: transform connInfo before editing
      driverAliases: DRIVER_ALIASES, // From src/sqltools/constants.ts
    };
  } catch (error) {
    console.error("Failed to register PostHog driver with SQLTools:", error);
    vscode.window.showErrorMessage(
      "Failed to register PostHog driver with SQLTools. See console for details."
    );
    // Return a compliant but non-functional API in case of error during SQLTools specific activation
    return {
      driverName: `${displayName} (Error during SQLTools registration)`,
      driverAliases: DRIVER_ALIASES,
    };
  }
}

export function deactivate() {
  // Clean up resources if needed
}
