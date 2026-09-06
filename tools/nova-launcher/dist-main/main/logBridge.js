import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
let classifier = null;
let repoRootForClassifier = null;
export function setClassifierRepoRoot(repoRoot) {
    repoRootForClassifier = repoRoot;
}
export async function loadLogClassifier(repoRoot) {
    if (classifier)
        return classifier;
    const root = repoRoot ?? repoRootForClassifier;
    if (!root)
        return null;
    const modPath = pathToFileURL(join(root, 'scripts/lib/logClassifier.mjs')).href;
    classifier = await import(modPath);
    return classifier;
}
export function classifyLineSync(line) {
    if (!classifier)
        return 'default';
    return classifier.classifyLogLine(line);
}
