import * as vscode from "vscode";

export type TourSettings = {
  includeGlob: string;
  excludeGlob: string;
  maxFiles: number;
};

export type FileFact = {
  uri: vscode.Uri;
  relativePath: string;
  extension: string;
  topDir: string;
};

export type ScoredEntry = {
  file: string;
  score: number;
  reason: string;
};

export type TourSummary = {
  generatedAtUtc: string;
  workspaceRoot: string;
  filesDiscovered: number;
  filesScanned: number;
  testFileCount: number;
  topExtensions: Array<{ extension: string; count: number }>;
  topDirectories: Array<{ name: string; count: number }>;
  likelyEntrypoints: ScoredEntry[];
  routeSurface: string[];
  externalDependencies: Array<{ name: string; count: number }>;
  internalHotspots: Array<{ file: string; localImports: number }>;
  packageScripts: Array<{ file: string; scripts: string[] }>;
};

export const DEFAULT_CODEBASE_TOUR_INCLUDE_GLOB =
  "**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs,py,java,go,rs,cs,php,rb,json,yml,yaml}";
export const DEFAULT_CODEBASE_TOUR_EXCLUDE_GLOB =
  "**/{node_modules,.git,dist,build,out,coverage,.next,.turbo,Memory-bank,logs,.venv,venv,target}/**";
export const DEFAULT_CODEBASE_TOUR_MAX_FILES = 1500;

export const MAX_ENTRYPOINTS = 20;
export const MAX_ROUTES = 35;
export const MAX_DEPENDENCIES = 20;
export const MAX_INTERNAL_HOTSPOTS = 20;
export const MAX_TOP_EXTENSIONS = 12;
export const MAX_TOP_DIRECTORIES = 15;
