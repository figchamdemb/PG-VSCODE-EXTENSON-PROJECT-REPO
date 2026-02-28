import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

type ValidationLibraryOption = {
  id: string;
  packageName: string;
  label: string;
  docsUrl: string;
  detail: string;
};

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

type SetupValidationLibraryArgs =
  | string
  | {
      library?: string;
    };

const VALIDATION_LIBRARY_OPTIONS: ValidationLibraryOption[] = [
  {
    id: "zod",
    packageName: "zod",
    label: "Zod (Recommended)",
    docsUrl: "https://zod.dev/",
    detail: "Type-safe runtime schemas, strong TypeScript alignment."
  },
  {
    id: "valibot",
    packageName: "valibot",
    label: "Valibot",
    docsUrl: "https://valibot.dev/",
    detail: "Schema validation with small bundle footprint."
  },
  {
    id: "joi",
    packageName: "joi",
    label: "Joi",
    docsUrl: "https://joi.dev/",
    detail: "Mature schema validation library."
  },
  {
    id: "yup",
    packageName: "yup",
    label: "Yup",
    docsUrl: "https://github.com/jquense/yup",
    detail: "Popular object schema validation."
  },
  {
    id: "ajv",
    packageName: "ajv",
    label: "AJV",
    docsUrl: "https://ajv.js.org/",
    detail: "JSON schema validator."
  }
];

const SUPPORTED_VALIDATION_LIBRARIES = new Set(
  VALIDATION_LIBRARY_OPTIONS.map((item) => item.packageName).concat("class-validator")
);

const COMMAND_MAX_BUFFER_BYTES = 1024 * 1024 * 16;

export function registerSetupValidationLibraryCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    "narrate.setupValidationLibrary",
    async (args?: SetupValidationLibraryArgs) => runSetupValidationLibraryCommand(args)
  );
}

async function runSetupValidationLibraryCommand(
  args?: SetupValidationLibraryArgs
): Promise<void> {
  const workspaceRoot = resolveWorkspaceRoot();
  if (!workspaceRoot) {
    return;
  }

  const installed = readInstalledValidationLibraries(workspaceRoot);
  const selected = await resolveSelectedLibrary(args, installed);
  if (!selected) {
    return;
  }
  if (await handleAlreadyInstalledSelection(selected, installed)) {
    return;
  }

  const packageManager = detectPackageManager(workspaceRoot);
  if (!(await confirmLibraryInstall(selected.packageName, packageManager))) {
    return;
  }

  await installLibraryWithProgress(selected.packageName, packageManager, workspaceRoot);
  await handleInstallSuccess(selected);
}

function resolveWorkspaceRoot(): string | undefined {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    void vscode.window.showWarningMessage(
      "Narrate: open a workspace folder before installing a validation library."
    );
    return undefined;
  }
  return workspace.uri.fsPath;
}

async function resolveSelectedLibrary(
  args: SetupValidationLibraryArgs | undefined,
  installed: string[]
): Promise<ValidationLibraryOption | undefined> {
  const requested = resolveRequestedLibrary(args);
  return requested ?? pickValidationLibrary(installed);
}

async function handleAlreadyInstalledSelection(
  selected: ValidationLibraryOption,
  installed: string[]
): Promise<boolean> {
  if (!installed.includes(selected.packageName)) {
    return false;
  }
  const action = await vscode.window.showInformationMessage(
    `Narrate: ${selected.packageName} is already installed.`,
    "Open Docs",
    "Refresh Trust Score"
  );
  if (action === "Open Docs") {
    await vscode.env.openExternal(vscode.Uri.parse(selected.docsUrl));
    return true;
  }
  if (action === "Refresh Trust Score") {
    await vscode.commands.executeCommand("narrate.refreshTrustScore");
  }
  return true;
}

async function confirmLibraryInstall(
  packageName: string,
  packageManager: PackageManager
): Promise<boolean> {
  const confirmation = await vscode.window.showWarningMessage(
    `Install latest ${packageName} using ${packageManager}?`,
    { modal: true },
    "Install"
  );
  return confirmation === "Install";
}

async function installLibraryWithProgress(
  packageName: string,
  packageManager: PackageManager,
  workspaceRoot: string
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Narrate: Installing ${packageName}`,
      cancellable: false
    },
    async () => {
      const command = buildInstallCommand(packageManager, packageName);
      await runPackageCommand(command.command, command.args, workspaceRoot);
    }
  );
}

async function handleInstallSuccess(selected: ValidationLibraryOption): Promise<void> {
  const resultAction = await vscode.window.showInformationMessage(
    `Narrate: installed latest ${selected.packageName}.`,
    "Open Docs",
    "Refresh Trust Score"
  );
  if (resultAction === "Open Docs") {
    await vscode.env.openExternal(vscode.Uri.parse(selected.docsUrl));
  }
  await vscode.commands.executeCommand("narrate.refreshTrustScore");
}

function readInstalledValidationLibraries(workspaceRoot: string): string[] {
  const packageJsonPath = path.join(workspaceRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const merged = {
      ...(parsed.dependencies ?? {}),
      ...(parsed.devDependencies ?? {}),
      ...(parsed.peerDependencies ?? {}),
      ...(parsed.optionalDependencies ?? {})
    };
    return Object.keys(merged).filter((name) =>
      SUPPORTED_VALIDATION_LIBRARIES.has(name)
    );
  } catch {
    return [];
  }
}

async function pickValidationLibrary(
  installed: string[]
): Promise<ValidationLibraryOption | undefined> {
  const picked = await vscode.window.showQuickPick(
    VALIDATION_LIBRARY_OPTIONS.map((item) => ({
      label: item.label,
      description: installed.includes(item.packageName)
        ? `${item.packageName} (already installed)`
        : item.packageName,
      detail: item.detail,
      option: item
    })),
    {
      title: "Narrate: Setup Validation Library",
      placeHolder: "Choose a validation library to install latest package",
      ignoreFocusOut: true
    }
  );

  return picked?.option;
}

function resolveRequestedLibrary(
  args?: SetupValidationLibraryArgs
): ValidationLibraryOption | undefined {
  if (!args) {
    return undefined;
  }
  const raw =
    typeof args === "string" ? args : typeof args.library === "string" ? args.library : "";
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return VALIDATION_LIBRARY_OPTIONS.find(
    (item) =>
      item.id.toLowerCase() === normalized ||
      item.packageName.toLowerCase() === normalized ||
      item.label.toLowerCase() === normalized
  );
}

function detectPackageManager(workspaceRoot: string): PackageManager {
  if (fs.existsSync(path.join(workspaceRoot, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (fs.existsSync(path.join(workspaceRoot, "yarn.lock"))) {
    return "yarn";
  }
  if (
    fs.existsSync(path.join(workspaceRoot, "bun.lockb")) ||
    fs.existsSync(path.join(workspaceRoot, "bun.lock"))
  ) {
    return "bun";
  }
  return "npm";
}

function buildInstallCommand(
  packageManager: PackageManager,
  packageName: string
): { command: string; args: string[] } {
  if (packageManager === "pnpm") {
    return { command: resolveBinary("pnpm"), args: ["add", packageName] };
  }
  if (packageManager === "yarn") {
    return { command: resolveBinary("yarn"), args: ["add", packageName] };
  }
  if (packageManager === "bun") {
    return { command: resolveBinary("bun"), args: ["add", packageName] };
  }
  return {
    command: resolveBinary("npm"),
    args: ["install", "--save", packageName]
  };
}

function resolveBinary(command: string): string {
  if (process.platform === "win32") {
    return `${command}.cmd`;
  }
  return command;
}

async function runPackageCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd,
        windowsHide: true,
        maxBuffer: COMMAND_MAX_BUFFER_BYTES
      },
      (error, stdout, stderr) => {
        if (error) {
          const details = [stderr, stdout, error.message]
            .map((item) => item?.trim())
            .filter(Boolean)
            .join(" | ");
          reject(new Error(details || `Command failed: ${command} ${args.join(" ")}`));
          return;
        }
        resolve();
      }
    );
  });
}
