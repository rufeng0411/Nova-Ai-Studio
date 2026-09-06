export function shouldSkipBridgeDeliverableMetaWrite(input: {
  turnId?: string;
  metaByTurnId?: Set<string>;
  acceptanceMetaByTurnId?: Set<string>;
}): boolean;

export function scheduleTurnDeliverableMetaWrite(input: {
  sessionKey: string;
  turnId?: string;
  projectKey?: string;
  projectName?: string;
}): Promise<void>;
