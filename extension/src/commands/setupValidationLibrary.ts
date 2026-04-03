import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getValidationLibraryState } from "../trust/trustScoreAnalysisUtils";

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
const SPRING_VALIDATION_DOCS_URL =
  "https://docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html";

const MAVEN_VALIDATION_SNIPPET = [
  "<dependency>",
  "  <groupId>org.springframework.boot</groupId>",
  "  <artifactId>spring-boot-starter-validation</artifactId>",
  "</dependency>"
].join("\n");

const GRADLE_VALIDATION_SNIPPET =
  "implementation 'org.springframework.boot:spring-boot-starter-validation'";

const GRADLE_KTS_VALIDATION_SNIPPET =
  "implementation(\"org.springframework.boot:spring-boot-starter-validation\")";

export function registerSetupValidationLibraryCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    "narrate.setupValidationLibrary",
    async (args?: SetupValidationLibraryArgs) => runSetupValidationLibraryCommand(args)
  );
}

async function runSetupValidationLibraryCommand(
  args?: SetupValidationLibraryArgs
): Promise<void> {
  const validationState = getValidationLibraryState();
  if (validationState.kind !== "node" || !validationState.manifestPath || !validationState.projectRoot) {
    await handleNonNodeValidationWorkspace(validationState.kind, validationState.manifestPath);
    return;
  }

  const packageJsonPath = validationState.manifestPath;
  const projectRoot = validationState.projectRoot;
  const installed = readInstalledValidationLibraries(packageJsonPath);
  const selected = await resolveSelectedLibrary(args, installed);
  if (!selected) {
    return;
  }
  if (await handleAlreadyInstalledSelection(selected, installed)) {
    return;
  }

  const packageManager = detectPackageManager(projectRoot);
  if (!(await confirmLibraryInstall(selected.packageName, packageManager))) {
    return;
  }

  try {
    await installLibraryWithProgress(selected.packageName, packageManager, projectRoot);
    await handleInstallSuccess(selected, projectRoot);
  } catch (error) {
    await handleInstallFailure(selected, projectRoot, packageManager, error);
  }
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

async function handleInstallSuccess(
  selected: ValidationLibraryOption,
  projectRoot: string
): Promise<void> {
  const projectLabel = path.basename(projectRoot) || projectRoot;
  const resultAction = await vscode.window.showInformationMessage(
    `Narrate: installed latest ${selected.packageName} in ${projectLabel}.`,
    "Open Docs",
    "Refresh Trust Score"
  );
  if (resultAction === "Open Docs") {
    await vscode.env.openExternal(vscode.Uri.parse(selected.docsUrl));
  }
  await vscode.commands.executeCommand("narrate.refreshTrustScore");
}

async function handleInstallFailure(
  selected: ValidationLibraryOption,
  projectRoot: string,
  packageManager: PackageManager,
  error: unknown
): Promise<void> {
  const projectLabel = path.basename(projectRoot) || projectRoot;
  const message = error instanceof Error ? error.message : String(error);
  const action = await vscode.window.showErrorMessage(
    `Narrate: failed to install ${selected.packageName} in ${projectLabel}. ${message}`,
    "Open Docs",
    "Copy Install Command"
  );
  if (action === "Open Docs") {
    await vscode.env.openExternal(vscode.Uri.parse(selected.docsUrl));
    return;
  }
  if (action === "Copy Install Command") {
    const command = `${packageManager} ${buildInstallCommand(packageManager, selected.packageName).args.join(" ")}`;
    await vscode.env.clipboard.writeText(command);
    void vscode.window.showInformationMessage(
      `Narrate: copied install command for ${selected.packageName}.`
    );
  }
}

async function handleNonNodeValidationWorkspace(
  kind: "node" | "java" | "unknown",
  manifestPath: string | null
): Promise<void> {
  if (kind === "java") {
    const primaryAction = await vscode.window.showInformationMessage(
      "Narrate: this workspace looks like Java. Zod is for Node/TypeScript, so Narrate will not install it here. Use Spring/Jakarta validation instead.",
      "Copy Maven Snippet",
      "Copy Gradle Snippet",
      "Open Docs"
    );

    if (primaryAction === "Copy Maven Snippet") {
      await vscode.env.clipboard.writeText(MAVEN_VALIDATION_SNIPPET);
      void vscode.window.showInformationMessage(
        "Narrate: copied Maven validation dependency."
      );
      return;
    }
    if (primaryAction === "Copy Gradle Snippet") {
      const snippet = manifestPath?.endsWith(".kts")
        ? GRADLE_KTS_VALIDATION_SNIPPET
        : GRADLE_VALIDATION_SNIPPET;
      await vscode.env.clipboard.writeText(snippet);
      void vscode.window.showInformationMessage(
        "Narrate: copied Gradle validation dependency."
      );
      return;
    }
    if (primaryAction === "Open Docs") {
      await vscode.env.openExternal(vscode.Uri.parse(SPRING_VALIDATION_DOCS_URL));
    }
    return;
  }

  const action = await vscode.window.showWarningMessage(
    "Narrate: no Node package.json was found near the current file, so automatic validation-library install cannot run here.",
    "Open Zod Docs"
  );
  if (action === "Open Zod Docs") {
    await vscode.env.openExternal(vscode.Uri.parse("https://zod.dev/"));
  }
}

function readInstalledValidationLibraries(packageJsonPath: string): string[] {
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
