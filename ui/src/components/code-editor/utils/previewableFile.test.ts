import { describe, expect, it } from 'vitest';
import { isAudioEditorFile, isPreviewableEditorFile, isTextPreviewFile } from './previewableFile';
import { isAudioFile, isPreviewableBinaryFile } from './binaryFile';

describe('previewableFile', () => {
  it('treats text and logs as previewable lightweight documents', () => {
    expect(isPreviewableEditorFile('notes.txt')).toBe(true);
    expect(isPreviewableEditorFile('gateway.log')).toBe(true);
    expect(isTextPreviewFile('notes.txt')).toBe(true);
    expect(isTextPreviewFile('gateway.log')).toBe(true);
  });

  it('treats audio as previewable media in binary and editor capability checks', () => {
    expect(isAudioFile('voice-over.mp3')).toBe(true);
    expect(isAudioEditorFile('voice-over.mp3')).toBe(true);
    expect(isPreviewableBinaryFile('voice-over.mp3')).toBe(true);
    expect(isPreviewableEditorFile('voice-over.mp3')).toBe(true);
  });
});
