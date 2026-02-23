import * as vscode from "vscode";

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  timeoutMs: number;
}

export function readLlmConfig(): LlmConfig {
  const config = vscode.workspace.getConfiguration("narrate.model");
  return {
    baseUrl: config.get<string>("baseUrl", "https://api.openai.com/v1").replace(/\/+$/, ""),
    apiKey: config.get<string>("apiKey", "").trim(),
    modelId: config.get<string>("modelId", "gpt-4o-mini").trim(),
    timeoutMs: config.get<number>("timeoutMs", 25000)
  };
}
