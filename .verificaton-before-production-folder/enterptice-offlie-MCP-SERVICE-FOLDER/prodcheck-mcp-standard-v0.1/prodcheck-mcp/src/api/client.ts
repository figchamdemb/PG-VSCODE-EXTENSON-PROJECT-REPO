import { ScanMetadata, ScoredReport } from "../types";

// ============================================================
// PRODGUARD API CLIENT
// Sends ONLY metadata to your scoring API. NEVER sends source code.
// The API holds all proprietary rules, weights, and scoring logic.
// ============================================================

const DEFAULT_API_URL = "https://api.prodguard.dev/v1";

interface ApiConfig {
  apiUrl: string;
  apiKey: string;
}

export class ProdGuardApiClient {
  private config: ApiConfig;

  constructor(config?: Partial<ApiConfig>) {
    this.config = {
      apiUrl: config?.apiUrl || process.env.PRODGUARD_API_URL || DEFAULT_API_URL,
      apiKey: config?.apiKey || process.env.PRODGUARD_API_KEY || "",
    };
  }

  /**
   * Send scan metadata to the API for proprietary scoring.
   * The API applies hidden weights, severity classification, and generates the report.
   * 
   * WHAT IS SENT: rule IDs, pass/fail status, file paths, line numbers, stats
   * WHAT IS NOT SENT: source code, file contents, business logic
   */
  async submitScan(metadata: ScanMetadata): Promise<ScoredReport> {
    // Strip file contents from metadata before sending (safety net)
    const safeMetadata = {
      ...metadata,
      findings: metadata.findings.map((f) => ({
        ruleId: f.ruleId,
        category: f.category,
        severity: f.severity,
        status: f.status,
        title: f.title,
        detail: f.detail,
        file: f.file,
        line: f.line,
        // recommendation is NOT sent — the API generates its own
      })),
    };

    try {
      const response = await fetch(`${this.config.apiUrl}/scans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          "X-Client": "prodguard-mcp/0.1.0",
        },
        body: JSON.stringify(safeMetadata),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid API key. Set PRODGUARD_API_KEY environment variable.");
        }
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Upgrade your plan for more scans.");
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as ScoredReport;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        // Network error — fall back to local scoring
        return this.localFallbackScore(metadata);
      }
      throw error;
    }
  }

  /**
   * Fallback scoring when API is unreachable.
   * This is a BASIC score — the real scoring logic is on the server.
   * This exists so the tool is still useful offline, but with limited intelligence.
   */
  private localFallbackScore(metadata: ScanMetadata): ScoredReport {
    const blockers = metadata.findings.filter((f) => f.severity === "blocker" && f.status === "fail");
    const warnings = metadata.findings.filter((f) => f.severity === "warning" && f.status === "fail");
    const infos = metadata.findings.filter((f) => f.severity === "info" && f.status === "fail");

    let score = 100;
    score -= blockers.length * 15;
    score -= warnings.length * 5;
    score -= infos.length * 1;
    score = Math.max(0, Math.min(100, score));

    const grade =
      score >= 95 ? "A+" : score >= 90 ? "A" : score >= 85 ? "A-" :
      score >= 80 ? "B+" : score >= 75 ? "B" : score >= 70 ? "B-" :
      score >= 65 ? "C+" : score >= 60 ? "C" : score >= 50 ? "D" : "F";

    return {
      scanId: metadata.scanId,
      score,
      grade,
      productionReady: blockers.length === 0,
      blockers: blockers.length,
      warnings: warnings.length,
      infos: infos.length,
      findings: metadata.findings.map((f, i) => ({ ...f, priority: i + 1 })),
      summary: blockers.length > 0
        ? `${blockers.length} blocker(s) must be fixed before production (offline scoring — connect for full analysis)`
        : `No blockers found (offline scoring — connect for full analysis)`,
    };
  }

  /**
   * Check if API is reachable and the key is valid
   */
  async healthCheck(): Promise<{ connected: boolean; plan?: string; scansRemaining?: number }> {
    try {
      const response = await fetch(`${this.config.apiUrl}/health`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      if (response.ok) {
        const data = await response.json();
        return { connected: true, plan: data.plan, scansRemaining: data.scansRemaining };
      }
      return { connected: false };
    } catch {
      return { connected: false };
    }
  }
}
