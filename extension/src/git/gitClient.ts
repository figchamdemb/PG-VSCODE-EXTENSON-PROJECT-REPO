import { execFile } from "child_process";
import * as vscode from "vscode";

function execGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

export class GitClient {
  constructor(private readonly workspaceRoot: string) {}

  static fromWorkspace(): GitClient | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return undefined;
    }
    return new GitClient(folder.uri.fsPath);
  }

  async isGitRepository(): Promise<boolean> {
    try {
      const value = await execGit(["rev-parse", "--is-inside-work-tree"], this.workspaceRoot);
      return value.trim() === "true";
    } catch {
      return false;
    }
  }

  async getCurrentBranchName(): Promise<string> {
    try {
      const value = await execGit(["rev-parse", "--abbrev-ref", "HEAD"], this.workspaceRoot);
      return value.trim() || "unknown";
    } catch {
      return "unknown";
    }
  }

  async getWorkingTreeDiffAgainstHead(): Promise<string> {
    // Includes staged + unstaged changes relative to HEAD.
    const diff = await execGit(["diff", "--no-color", "--unified=3", "HEAD"], this.workspaceRoot);
    return diff;
  }

  async getRepositoryRoot(): Promise<string> {
    const root = await execGit(["rev-parse", "--show-toplevel"], this.workspaceRoot);
    return root.trim();
  }
}
