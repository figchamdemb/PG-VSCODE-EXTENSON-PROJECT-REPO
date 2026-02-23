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
    const providerDecision = this.gates?.canUseProvider(config.baseUrl);
    if (providerDecision && !providerDecision.allowed) {
      this.logger.warn(
        `Provider call blocked by entitlement policy. reason=${providerDecision.reason ?? "unknown"}`
      );
      return [];
    }

    if (!config.apiKey || !config.baseUrl || !config.modelId) {
      this.logger.warn("Model API configuration is missing. Using fallback narration for cache misses.");
      return [];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.modelId,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: buildSystemPrompt(mode)
            },
            {
              role: "user",
              content: buildUserPrompt(filePath, mode, lines)
            }
          ],
          response_format: {
            type: "json_object"
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        this.logger.warn(`Provider response failed: ${response.status} ${response.statusText}`);
        return [];
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const rawContent = payload.choices?.[0]?.message?.content ?? "";
      if (!rawContent) {
        this.logger.warn("Provider returned empty content.");
        return [];
      }

      const items = parseNarrationPayload(rawContent);
      this.logger.info(`Provider generated narration lines: ${items.length}`);
      return items;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Provider call failed: ${message}`);
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}
