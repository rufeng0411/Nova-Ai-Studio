import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

let classifier: {
  classifyLogLine: (line: string) => 'default' | 'info' | 'success' | 'muted' | 'error';
} | null = null;

let repoRootForClassifier: string | null = null;

export function setClassifierRepoRoot(repoRoot: string) {
  repoRootForClassifier = repoRoot;
}

export async function loadLogClassifier(repoRoot?: string) {
  if (classifier) return classifier;
  const root = repoRoot ?? repoRootForClassifier;
  if (!root) return null;
  const modPath = pathToFileURL(join(root, 'scripts/lib/logClassifier.mjs')).href;
  classifier = await import(modPath);
  return classifier!;
}

export function classifyLineSync(line: string): 'default' | 'info' | 'success' | 'muted' | 'error' {
  if (!classifier) return 'default';
  return classifier.classifyLogLine(line);
}
