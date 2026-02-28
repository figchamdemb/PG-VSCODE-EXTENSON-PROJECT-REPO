import { buildSystemPrompt, buildUserPrompt } from "../narration/promptTemplates";
import { parseNarrationPayload } from "../narration/outputValidator";
import { LineInput, NarrationItem, NarrationMode } from "../types";
import { Logger } from "../utils/logger";
import { FeatureGateService } from "../licensing/featureGates";
import { readLlmConfig } from "./config";
import { LlmProvider } from "./provider";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

type LlmConfig = ReturnType<typeof readLlmConfig>;

export class OpenAICompatibleProvider implements LlmProvider {
  constructor(
    private readonly logger: Logger,
    private readonly gates?: FeatureGateService
  ) {}

  async narrateLines(filePath: string, mode: NarrationMode, lines: LineInput[]): Promise<NarrationItem[]> {
    if (lines.length === 0) {
      return [];
    }

    const config = readLlmConfig();
    if (!this.isProviderAllowed(config.baseUrl) || !this.hasRequiredConfig(config)) {
      return [];
    }
    return this.requestNarration(filePath, mode, lines, config);
  }

  private isProviderAllowed(baseUrl: string): boolean {
    const providerDecision = this.gates?.canUseProvider(baseUrl);
    if (providerDecision && !providerDecision.allowed) {
      this.logger.warn(
        `Provider call blocked by entitlement policy. reason=${providerDecision.reason ?? "unknown"}`
      );
      return false;
    }
    return true;
  }

  private hasRequiredConfig(config: LlmConfig): boolean {
    if (config.apiKey && config.baseUrl && config.modelId) {
      return true;
    }
    this.logger.warn("Model API configuration is missing. Using fallback narration for cache misses.");
    return false;
  }

  private async requestNarration(
    filePath: string,
    mode: NarrationMode,
    lines: LineInput[],
    config: LlmConfig
  ): Promise<NarrationItem[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await this.fetchChatCompletion(filePath, mode, lines, config, controller.signal);
      if (!response.ok) {
        this.logger.warn(`Provider response failed: ${response.status} ${response.statusText}`);
        return [];
      }
      const payload = (await response.json()) as ChatCompletionResponse;
      return this.parseNarrationItems(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Provider call failed: ${message}`);
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private fetchChatCompletion(
    filePath: string,
    mode: NarrationMode,
    lines: LineInput[],
    config: LlmConfig,
    signal: AbortSignal
  ): Promise<Response> {
    return fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(this.buildCompletionBody(filePath, mode, lines, config)),
      signal
    });
  }

  private buildCompletionBody(filePath: string, mode: NarrationMode, lines: LineInput[], config: LlmConfig): object {
    return {
      model: config.modelId,
      temperature: 0.1,
      messages: [
        { role: "system", content: buildSystemPrompt(mode) },
        { role: "user", content: buildUserPrompt(filePath, mode, lines) }
      ],
      response_format: { type: "json_object" }
    };
  }

  private parseNarrationItems(payload: ChatCompletionResponse): NarrationItem[] {
    const rawContent = payload.choices?.[0]?.message?.content ?? "";
    if (!rawContent) {
      this.logger.warn("Provider returned empty content.");
      return [];
    }
    const items = parseNarrationPayload(rawContent);
    this.logger.info(`Provider generated narration lines: ${items.length}`);
    return items;
  }
}
