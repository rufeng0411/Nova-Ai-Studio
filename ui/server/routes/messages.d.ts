export type NormalizedWebMessage = {
  kind?: string;
  role?: string;
  sessionDeliverableManifest?: {
    slots?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  sessionManifestVersion?: number;
  goalVersion?: number;
  turnId?: string;
  verifiedDeliverablePaths?: string[];
  turnAcceptanceMeta?: {
    verifiedPaths?: string[];
    missingPaths?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export function mapWebMessageToNormalized(
  message: Record<string, unknown>,
  sessionId?: string,
): NormalizedWebMessage;
