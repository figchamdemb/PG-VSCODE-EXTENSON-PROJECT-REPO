import {
  ApiContractMismatch,
  EndpointContract,
  FieldShape,
  FrontendCall
} from "./types";
import { pathsMatch } from "./path";

export type ApiContractCompareResult = {
  mismatches: ApiContractMismatch[];
  unmatchedFrontendCalls: FrontendCall[];
};

export function compareApiContracts(
  contracts: EndpointContract[],
  frontendCalls: FrontendCall[]
): ApiContractCompareResult {
  const mismatches: ApiContractMismatch[] = [];
  const unmatchedFrontendCalls: FrontendCall[] = [];

  for (const call of frontendCalls) {
    const contract = findMatchingContract(contracts, call);
    if (!contract) {
      unmatchedFrontendCalls.push(call);
      continue;
    }
    mismatches.push(...compareRequestFields(contract, call));
    mismatches.push(...compareResponseFields(contract, call));
  }

  return {
    mismatches: dedupeMismatches(mismatches),
    unmatchedFrontendCalls
  };
}

function findMatchingContract(
  contracts: EndpointContract[],
  call: FrontendCall
): EndpointContract | undefined {
  for (const contract of contracts) {
    if (contract.method !== call.method) {
      continue;
    }
    if (pathsMatch(contract.path, call.path)) {
      return contract;
    }
  }
  return undefined;
}

function compareRequestFields(contract: EndpointContract, call: FrontendCall): ApiContractMismatch[] {
  const mismatches: ApiContractMismatch[] = [];
  const callMap = new Map(call.requestFields.map((field) => [field.name, field]));
  const contractMap = new Map(contract.requestFields.map((field) => [field.name, field]));
  appendMissingRequiredRequestFieldMismatches(mismatches, contract, call, callMap);
  appendRequestNamingAndTypeMismatches(mismatches, contract, call, contractMap);
  return mismatches;
}

function appendMissingRequiredRequestFieldMismatches(
  target: ApiContractMismatch[],
  contract: EndpointContract,
  call: FrontendCall,
  callMap: Map<string, FieldShape>
): void {
  for (const backendField of contract.requestFields.filter((field) => field.required)) {
    if (callMap.has(backendField.name)) {
      continue;
    }
    target.push({
      ruleId: "API-REQ-001",
      severity: "blocker",
      method: call.method,
      path: call.path,
      file: call.file,
      line: call.line,
      message: `Missing required request field \`${backendField.name}\`.`
    });
  }
}

function appendRequestNamingAndTypeMismatches(
  target: ApiContractMismatch[],
  contract: EndpointContract,
  call: FrontendCall,
  contractMap: Map<string, FieldShape>
): void {
  for (const frontendField of call.requestFields) {
    if (contractMap.has(frontendField.name)) {
      target.push(...compareFieldTypes(contract, call, frontendField));
      continue;
    }
    const mappedField = findNamingMatch(contract.requestFields, frontendField.name);
    if (!mappedField) {
      continue;
    }
    target.push({
      ruleId: "API-REQ-002",
      severity: "warning",
      method: call.method,
      path: call.path,
      file: call.file,
      line: call.line,
      message: `Field naming mismatch: frontend \`${frontendField.name}\` vs backend \`${mappedField.name}\`.`
    });
  }
}

function compareFieldTypes(
  contract: EndpointContract,
  call: FrontendCall,
  frontendField: FieldShape
): ApiContractMismatch[] {
  if (!frontendField.type) {
    return [];
  }

  const backendField = contract.requestFields.find((field) => field.name === frontendField.name);
  if (!backendField?.type) {
    return [];
  }
  if (areCompatibleTypes(frontendField.type, backendField.type)) {
    return [];
  }

  return [
    {
      ruleId: "API-TYPE-001",
      severity: "blocker",
      method: call.method,
      path: call.path,
      file: call.file,
      line: call.line,
      message: `Type mismatch for \`${frontendField.name}\`: frontend \`${frontendField.type}\` vs backend \`${backendField.type}\`.`
    }
  ];
}

function compareResponseFields(contract: EndpointContract, call: FrontendCall): ApiContractMismatch[] {
  if (call.responseFields.length === 0 || contract.responseFields.length === 0) {
    return [];
  }

  const backendNames = new Set(contract.responseFields.map((field) => field.name));
  const mismatches: ApiContractMismatch[] = [];
  for (const frontendField of call.responseFields) {
    if (backendNames.has(frontendField)) {
      continue;
    }
    if (findNamingMatch(contract.responseFields, frontendField)) {
      continue;
    }
    mismatches.push({
      ruleId: "API-RES-001",
      severity: "warning",
      method: call.method,
      path: call.path,
      file: call.file,
      line: call.line,
      message: `Frontend reads response field \`${frontendField}\` that is not defined in backend contract.`
    });
  }
  return mismatches;
}

function findNamingMatch(fields: FieldShape[], candidate: string): FieldShape | undefined {
  const normalizedCandidate = normalizeFieldToken(candidate);
  return fields.find((field) => normalizeFieldToken(field.name) === normalizedCandidate);
}

function normalizeFieldToken(value: string): string {
  return value.replace(/[_\-\s]/gu, "").toLowerCase();
}

function areCompatibleTypes(left: string, right: string): boolean {
  const normalize = (value: string): string =>
    value.toLowerCase() === "integer" ? "number" : value.toLowerCase();
  return normalize(left) === normalize(right);
}

function dedupeMismatches(mismatches: ApiContractMismatch[]): ApiContractMismatch[] {
  const byKey = new Map<string, ApiContractMismatch>();
  for (const mismatch of mismatches) {
    const key = [
      mismatch.ruleId,
      mismatch.method,
      mismatch.path,
      mismatch.file,
      mismatch.line,
      mismatch.message
    ].join("|");
    if (!byKey.has(key)) {
      byKey.set(key, mismatch);
    }
  }
  return Array.from(byKey.values()).sort((left, right) => {
    if (left.file !== right.file) {
      return left.file.localeCompare(right.file);
    }
    if (left.line !== right.line) {
      return left.line - right.line;
    }
    return left.ruleId.localeCompare(right.ruleId);
  });
}
