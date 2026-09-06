// PD-SAAS-FORK: atomic text file write (.tmp + rename)
import fsPromises from 'node:fs/promises';

/**
 * Write UTF-8 text atomically. On failure, leaves previous file intact.
 * @param {string} filePath
 * @param {string} content
 */
export async function atomicWriteTextFile(filePath, content) {
  const tmpPath = `${filePath}.tmp`;
  await fsPromises.writeFile(tmpPath, content, 'utf8');
  await fsPromises.rename(tmpPath, filePath);
}
