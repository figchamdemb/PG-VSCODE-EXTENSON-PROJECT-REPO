import { execFile } from "child_process";

const SHELL_BUFFER_BYTES = 1024 * 1024 * 4;

export type PowerShellRunResult = {
  shell: "pwsh" | "powershell";
  code: number;
  stdout: string;
  stderr: string;
};

export async function runPowerShellCommand(
  args: string[],
  cwd: string
): Promise<PowerShellRunResult> {
  try {
    return await runWithShell("pwsh", args, cwd);
  } catch (error) {
    if (!isCommandMissing(error)) {
      throw error;
    }
  }
  return runWithShell("powershell", args, cwd);
}

function runWithShell(
  shell: "pwsh" | "powershell",
  args: string[],
  cwd: string
): Promise<PowerShellRunResult> {
  return new Promise<PowerShellRunResult>((resolve, reject) => {
    execFile(
      shell,
      args,
      { cwd, windowsHide: true, maxBuffer: SHELL_BUFFER_BYTES },
      (error, stdout, stderr) => {
        const out = stdout.trim();
        const err = stderr.trim();
        if (error) {
          const details = [err, out, error.message]
            .map((item) => item?.trim())
            .filter(Boolean)
            .join(" | ");
          const wrapped = new Error(details || `${shell} ${args.join(" ")} failed`);
          Object.assign(wrapped, { code: (error as NodeJS.ErrnoException).code });
          reject(wrapped);
          return;
        }
        resolve({
          shell,
          code: 0,
          stdout: out,
          stderr: err
        });
      }
    );
  });
}

function isCommandMissing(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const errno = error as NodeJS.ErrnoException;
  return errno.code === "ENOENT";
}
