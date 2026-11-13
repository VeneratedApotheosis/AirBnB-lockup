export type CandidateKind = "image-alt" | "control-name" | "heading";
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface Candidate {
  id: string;
  kind: CandidateKind;
  context: {
    tagName: string;
    purposeHint?: string;
    nearbyText?: string;
    headingLevel?: HeadingLevel;
  };
}

export interface AuditFinding {
  ruleId: string;
  description: string;
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  nodeCount: number;
  wcagTags: string[];
}

export interface ScanResult {
  scanId: string;
  findings: AuditFinding[];
  candidates: Candidate[];
}

interface ProposalDetails {
  candidateId: string;
  reason: string;
}

export type ApplicableProposal = ProposalDetails & (
  | { kind: "image-alt"; value: string }
  | { kind: "control-name"; value: string }
);

export type Proposal = ApplicableProposal | (ProposalDetails & {
  kind: "heading";
  value: HeadingLevel;
});

export interface SuggestRequest {
  candidates: Candidate[];
}

export interface SuggestResult {
  proposals: Proposal[];
  source: "mock" | "ai";
}

export interface ApplyResult {
  applied: string[];
  skipped: { candidateId: string; reason: string }[];
}

export interface UndoResult {
  restored: number;
  skipped: number;
}

export type Profile = "default" | "low-vision" | "reading";

export interface OperationMap {
  scan: { input: null; output: ScanResult };
  suggest: { input: SuggestRequest; output: SuggestResult };
  apply: {
    input: { scanId: string; proposals: ApplicableProposal[] };
    output: ApplyResult;
  };
  undo: { input: null; output: UndoResult };
  getProfile: { input: null; output: Profile };
  setProfile: { input: Profile; output: Profile };
}

export type Operation = keyof OperationMap;
export type PageOperation = "scan" | "apply" | "undo" | "setProfile";

export type Request<K extends Operation = Operation> = {
  [Name in K]: { type: Name; input: OperationMap[Name]["input"] };
}[K];

export type Reply<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
