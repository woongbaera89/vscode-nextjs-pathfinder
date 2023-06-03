import * as vscode from "vscode";

const MAX_FILES = 30000;
const SAFETY_COUNT = 24;
const PATTERN1 = "**/{app,pages}/**/*.*";

export function activate(context: vscode.ExtensionContext): void {
  let disposable = vscode.commands.registerCommand(
    "nextjs-pathfinder.findFile",
    () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        return;
      }

      const document = editor.document;
      const selection = editor.selection;
      let selectedText = document
        .getText(selection)
        .replace(/["'` \n\t\s]/g, "");

      // remove querystring and hash
      const matchHash = selectedText.match(/[^#]*/);
      selectedText = matchHash ? matchHash[0] : selectedText;
      const matchQS = selectedText.match(/[^?]*/);
      selectedText = matchQS ? matchQS[0] : selectedText;

      if (!selectedText) {
        vscode.window.showWarningMessage(
          "[Nextjs Pathfinder] No text selected."
        );
        return;
      }

      const segments = selectedText.split("/");
      if (segments[0] === "") {
        segments.shift();
      }

      vscode.workspace.findFiles(PATTERN1, null, MAX_FILES).then((uris) => {
        // Calculate match scores for all URIs
        const scoredUris = uris.map((uri) => {
          const relativePath = vscode.workspace.asRelativePath(uri.fsPath);

          try {
            const score = matchPattern(relativePath, segments);
            return { uri, score };
          } catch (err) {
            return { uri, score: 0 };
          }
        });

        // Filter and sort URIs based on match scores
        const minScore = Math.max(segments.length * 0.7, 1);
        const matchingUris = scoredUris
          .filter(({ score }) => score >= minScore)
          .sort((a, b) => b.score - a.score);

        if (matchingUris.length === 0) {
          vscode.window.showWarningMessage(
            `[Nextjs Pathfinder] No files found for: ${selectedText}`
          );
          return;
        }

        vscode.window
          .showQuickPick(
            matchingUris.map(({ uri, score }) => {
              const relativePath = vscode.workspace.asRelativePath(uri.fsPath);
              return {
                label: `${
                  relativePath?.length > 82
                    ? "..." + relativePath.slice(-80)
                    : relativePath
                }`,
                uri: uri.fsPath,
              };
            })
          )
          .then((selected) => {
            if (selected) {
              vscode.workspace.openTextDocument(selected.uri).then((doc) => {
                vscode.window.showTextDocument(doc);
              });
            }
          });
      });
    }
  );

  context.subscriptions.push(disposable);
}

function matchPattern(pattern: string, tokens: string[]): number {
  const removePageRoute =
    pattern.startsWith("app/") || pattern.startsWith("pages/")
      ? pattern.split(/(?:app|pages)\//)
      : pattern.split(/\/(?:app|pages)\//);
  const patternTokens = (
    removePageRoute.length > 1 ? removePageRoute[1] : ""
  ).split("/");
  const patternLength = patternTokens.length;
  const tokensLength = tokens.length;

  let score = 0;
  let i = patternLength - 1;
  let j = tokensLength - 1;
  let safeCount = SAFETY_COUNT;

  while (i >= 0 && j >= 0 && safeCount > 0) {
    console.log(patternTokens[i], tokens[j]);
    safeCount -= 1;
    if (!patternTokens[i] || !tokens[j]) {
      break;
    }

    // concern index.tsx | route.js | ...
    const target = patternTokens[i].split(/(?:.ts|.tsx|.js|.jsx)/)[0];

    if (target === tokens[j]) {
      score += 1;
      i -= 1;
      j -= 1;
    } else if (
      target.startsWith("[") &&
      target.endsWith("]") &&
      !tokens[j].startsWith("[") &&
      !tokens[j].endsWith("]")
    ) {
      score += 0.5;
      i -= 1;
      j -= 1;
    } else if (target !== tokens[j]) {
      if (target === "index" || target === "route") {
        score += 0.5;
      }
      i -= 1;
    } else {
      break;
    }
  }

  return score;
}

export function deactivate(): void {}
