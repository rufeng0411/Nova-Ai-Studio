export type DeliverableLinkEntry =
  | 'bodyLink'
  | 'deliverableCard'
  | 'fileTree'
  | 'rightDock'
  | 'overlay';

export type DeliverableLinkContract = {
  path: string;
  apiPath: string;
  resolvedPath: string;
  hintDir: string;
  turnArtifactDir: string;
  folderPath: string;
  displayStatus: 'verified' | 'softVerified' | 'pending' | 'hidden';
  entries: Record<DeliverableLinkEntry, string>;
};

export function buildDeliverableLinkContract(input: {
  apiPath?: string;
  resolvedPath?: string;
  hintDir?: string;
  turnArtifactDir?: string;
  validationStatus?: 'verified' | 'softVerified' | 'pending' | 'broken' | 'phantom' | string;
}): DeliverableLinkContract;
