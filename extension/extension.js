const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('PostHog ClickHouse Query Runner is now active');

  // Register the command to run a query
  let disposable = vscode.commands.registerCommand('posthog-clickhouse-query-runner.runQuery', async function () {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const filePath = editor.document.uri.fsPath;
    const normalizedFilePath = path.normalize(filePath);

    // Determine the user's workspace root for validating SQL file location
    let userWorkspaceRoot;
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      userWorkspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    } else {
      // If no workspace is open, we cannot reliably determine the project root for 'queries'
      vscode.window.showErrorMessage('Please open a folder or workspace to use this extension.');
      return;
    }
    const normalizedUserWorkspaceRoot = path.normalize(userWorkspaceRoot);

    // Check if the file is a .sql file
    if (!filePath.endsWith('.sql')) {
      vscode.window.showInformationMessage('This command only works with .sql files.');
      return;
    }

    // Check if the file is within the user's workspace root
    const relativePath = path.relative(normalizedUserWorkspaceRoot, normalizedFilePath);
    if (relativePath.startsWith('..')) {
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
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Running PostHog ClickHouse Query",
        cancellable: false
      }, async (progress) => {
        progress.report({ message: "Executing query..." });

        try {
          // Determine paths for the extension's own Python backend
          const extensionRoot = context.extensionPath; // Absolute path to the /extension directory (e.g., ~/.vscode/extensions/publisher.name-version)
          // The 'backend' module is now expected to be directly inside extensionRoot (e.g., extensionRoot/backend)
          const extensionCodeRoot = extensionRoot; // Root for Python sys.path to find the 'backend' module.
          const backendDir = path.join(extensionCodeRoot, 'backend'); // Path to the extension's 'backend' directory

          // Create the temp directory inside the extension's directory
          const tempDir = path.join(extensionRoot, 'temp');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }

          console.log('Extension root path (context.extensionPath):', extensionRoot);
          console.log('Extension code root (for Python sys.path):', extensionCodeRoot);
          console.log('Extension backend directory path:', backendDir);
          console.log('Temp directory path:', tempDir);
          console.log('User workspace root (for query validation):', normalizedUserWorkspaceRoot);


          // Create a temporary script to run the query
          const scriptContent = `
import sys
import os
import json
from pathlib import Path

# Add the extension's code root to the Python path to find its 'backend' module
sys.path.append("${extensionCodeRoot.replace(/\\/g, '\\\\')}")

from backend.query_executor import QueryExecutor

# Execute the query
query_file = "${filePath.replace(/\\/g, '\\\\')}"
executor = QueryExecutor()
result = executor.execute_query_from_file(query_file)
html_result = executor.format_results_as_html(result)

# Write the HTML result to a temporary file
temp_html_file = Path("${tempDir.replace(/\\/g, '\\\\')}/temp_result.html")
with open(temp_html_file, "w") as f:
    f.write(html_result)

# Print the path to the HTML file for the extension to read
print(temp_html_file)
`;

          const tempScriptPath = path.join(tempDir, 'temp_run_query.py');
          fs.writeFileSync(tempScriptPath, scriptContent);

          // Get API key and Project ID from VSCode configuration
          const config = vscode.workspace.getConfiguration('posthogClickhouseQueryRunner');
          const configuredApiKey = config.get('apiKey');
          const configuredProjectId = config.get('projectId');
          const envVars = { ...process.env }; // Clone current environment variables
          
          // Pass API key from VSCode config if available
          if (configuredApiKey) {
            envVars['POSTHOG_API_KEY_VSCODE_CONFIG'] = configuredApiKey;
            console.log('Using API key from VSCode configuration.');
          }

          // Pass Project ID from VSCode config if available
          if (configuredProjectId) {
            envVars['POSTHOG_PROJECT_ID_VSCODE_CONFIG'] = configuredProjectId;
            console.log('Using Project ID from VSCode configuration.');
          }
          
          // Pass user's workspace root to Python script for .env loading
          if (normalizedUserWorkspaceRoot) {
            envVars['USER_WORKSPACE_ROOT'] = normalizedUserWorkspaceRoot;
            console.log('Passing USER_WORKSPACE_ROOT to Python:', normalizedUserWorkspaceRoot);
          }

          // Run the Python script
          const pythonProcess = spawn('python', [tempScriptPath], { env: envVars });

          let outputData = '';
          let errorData = '';

          pythonProcess.stdout.on('data', (data) => {
            outputData += data.toString();
          });

          pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
          });

          return new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
              // Clean up the temporary script
              try {
                fs.unlinkSync(tempScriptPath);
              } catch (err) {
                console.error('Error deleting temporary script:', err);
              }

              if (code !== 0) {
                vscode.window.showErrorMessage(`Error executing query: ${errorData}`);
                reject(new Error(errorData));
                return;
              }

              // Get the path to the HTML result file
              const htmlFilePath = outputData.trim();
              console.log("Python script stdout (expected HTML file path):", outputData);
              console.log("Trimmed HTML file path being checked:", htmlFilePath);

              if (!htmlFilePath || !fs.existsSync(htmlFilePath)) {
                const notFoundMsg = `Error: Result file not found. Path checked: [${htmlFilePath || 'empty_path'}]. Python stdout: [${outputData}]`;
                console.error(notFoundMsg);
                vscode.window.showErrorMessage(notFoundMsg);
                reject(new Error(notFoundMsg));
                return;
              }

              // Create and show the webview panel
              const panel = vscode.window.createWebviewPanel(
                'posthogQueryResult',
                'PostHog Query Result',
                vscode.ViewColumn.Beside,
                {
                  enableScripts: true,
                  localResourceRoots: [vscode.Uri.file(path.dirname(htmlFilePath))]
                }
              );

              // Read the HTML content
              const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
              panel.webview.html = htmlContent;

              // Clean up the temporary HTML file when the panel is disposed
              panel.onDidDispose(() => {
                try {
                  fs.unlinkSync(htmlFilePath);
                } catch (err) {
                  console.error('Error deleting temporary HTML file:', err);
                }
              });

              resolve();
            });
          });
        } catch (error) {
          vscode.window.showErrorMessage(`Error executing query: ${error.message}`);
          throw error;
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

function deactivate() { }

module.exports = {
  activate,
  deactivate
};
