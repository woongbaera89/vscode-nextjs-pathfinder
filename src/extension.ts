import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "nextjs-pathfinder.findFile",
    () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showWarningMessage("[Pathfinder] No active editor!");
        return;
      }

      const document = editor.document;
      const selection = editor.selection;

      // Get the word within the selection. Replace special characters and square brackets.
      const selectedText = document
        .getText(selection)
        .replace(/["'` \n\t\s]/g, "")
        .replace(/\[(.*?)\]/g, "?$1?");

      if (!selectedText) {
        vscode.window.showWarningMessage("[Pathfinder] No text selected!");
        return;
      }

      const pattern = `**${selectedText}{.*,/*.*}`;
      vscode.workspace
        .findFiles(pattern, "**/node_modules/**", 100)
        .then((uris) => {
          if (!uris.length) {
            vscode.window.showWarningMessage(
              `[Pathfinder] No files found for selection: ${selectedText}`
            );
            return;
          }

          vscode.window
            .showQuickPick(
              uris.map((uri) => {
                const relativePath = vscode.workspace.asRelativePath(
                  uri.fsPath
                );
                return {
                  label:
                    relativePath?.length > 82
                      ? "..." + relativePath.slice(-80)
                      : relativePath,
                  uri: uri.fsPath,
                };
              })
            )
            .then((selected) => {
              if (selected) {
                vscode.workspace.openTextDocument(selected.uri).then((doc) => {
                  vscode.window.showTextDocument(doc);
                });
              } else {
                vscode.window.showWarningMessage(
                  "[Pathfinder] No file selected!"
                );
              }
            });
        });
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
