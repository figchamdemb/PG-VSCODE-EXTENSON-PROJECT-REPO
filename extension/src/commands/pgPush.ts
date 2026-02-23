import { execFile } from "child_process";
import * as vscode from "vscode";

const GIT_BUFFER_BYTES = 1024 * 1024 * 4;

type GitResult = {
  stdout: string;
  stderr: string;
};

export function registerPgPushCommands(): vscode.Disposable {
  const runner = async (): Promise<void> => {
    try {
      await runPgPushFlow();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: PG push failed. ${message}`);
    }
  };

  return vscode.Disposable.from(
    vscode.commands.registerCommand("narrate.pgPush", runner),
    vscode.commands.registerCommand("narrate.pgGit", runner)
  );
}

async function runPgPushFlow(): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    vscode.window.showWarningMessage("Narrate: open a workspace folder before PG push.");
    return;
  }
  const workspaceRoot = workspace.uri.fsPath;

  await ensureGitWorkspace(workspaceRoot);

  const defaultMessage = `PG update ${new Date().toISOString()}`;
  const commitMessage = await vscode.window.showInputBox({
    title: "Narrate PG Push",
    prompt: "Commit message for git commit",
    placeHolder: "PG update: ...",
    value: defaultMessage,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value.trim()) {
        return "Commit message is required.";
      }
      return undefined;
    }
  });
  if (!commitMessage) {
    return;
  }

  const confirmed = await vscode.window.showWarningMessage(
    `Run git add -A, git commit, and git push in:\n${workspaceRoot}`,
    { modal: true },
    "Run PG Push"
  );
  if (confirmed !== "Run PG Push") {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Narrate: Running PG push",
      cancellable: false
    },
    async (progress) => {
      progress.report({ message: "Checking git status..." });
      const status = await runGit(["status", "--porcelain"], workspaceRoot);
      const hasChanges = status.stdout.trim().length > 0;

      let committed = false;
      if (hasChanges) {
        progress.report({ message: "Staging files (git add -A)..." });
        await runGit(["add", "-A"], workspaceRoot);

        progress.report({ message: "Creating commit..." });
        try {
          await runGit(["commit", "-m", commitMessage.trim()], workspaceRoot);
          committed = true;
        } catch (error) {
          const details = getErrorText(error).toLowerCase();
          if (!details.includes("nothing to commit")) {
            throw error;
          }
        }
      }

      progress.report({ message: "Pushing to remote..." });
      await runGit(["push"], workspaceRoot);

      const branch = (await runGit(["rev-parse", "--abbrev-ref", "HEAD"], workspaceRoot)).stdout.trim();
      const commitState = hasChanges
        ? committed
          ? "Committed and pushed."
          : "Pushed without a new commit."
        : "No local changes to commit.";
      vscode.window.showInformationMessage(
        `Narrate: PG push completed on branch '${branch || "current"}'. ${commitState}`
      );
    }
  );
}

async function ensureGitWorkspace(workspaceRoot: string): Promise<void> {
  try {
    const inside = await runGit(["rev-parse", "--is-inside-work-tree"], workspaceRoot);
    if (inside.stdout.trim() !== "true") {
      throw new Error("Workspace is not a git repository.");
    }
  } catch (error) {
    throw new Error(
      `Workspace is not a git repository. ${getErrorText(error)}`
    );
  }
}

async function runGit(args: string[], cwd: string): Promise<GitResult> {
  return new Promise<GitResult>((resolve, reject) => {
    execFile(
      "git",
      args,
      { cwd, windowsHide: true, maxBuffer: GIT_BUFFER_BYTES },
      (error, stdout, stderr) => {
        if (error) {
          const details = [stderr, stdout, error.message]
            .map((item) => item?.trim())
            .filter(Boolean)
            .join(" | ");
          reject(new Error(details || `git ${args.join(" ")} failed`));
          return;
        }
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      }
    );
  });
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

