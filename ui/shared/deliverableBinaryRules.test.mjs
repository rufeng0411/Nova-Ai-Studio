import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PDF_MIN_BYTES,
  VIDEO_MIN_BYTES,
  isUndersizedBinaryDeliverable,
  isValidBinaryDeliverableHeader,
} from './deliverableBinaryRules.mjs';

test('accepts valid office/zip magic headers', () => {
  assert.equal(isValidBinaryDeliverableHeader('deck.pptx', 'PK\x03\x04....'), true);
  assert.equal(isValidBinaryDeliverableHeader('doc.docx', 'PK\x05\x06....'), true);
  assert.equal(isValidBinaryDeliverableHeader('sheet.xlsx', 'PK\x07\x08....'), true);
});

test('rejects office files that are not real zip containers', () => {
  assert.equal(isValidBinaryDeliverableHeader('deck.pptx', '<html><body>fake'), false);
  assert.equal(isValidBinaryDeliverableHeader('doc.docx', 'not a zip!!!!'), false);
});

test('validates pdf and image signatures', () => {
  assert.equal(isValidBinaryDeliverableHeader('report.pdf', '%PDF-1.7'), true);
  assert.equal(isValidBinaryDeliverableHeader('report.pdf', 'PK\x03\x04'), false);
  assert.equal(isValidBinaryDeliverableHeader('cover.png', '\x89PNG\r\n\x1a\n'), true);
  assert.equal(isValidBinaryDeliverableHeader('cover.png', 'not png!!'), false);
  assert.equal(isValidBinaryDeliverableHeader('photo.jpg', '\xff\xd8\xff\xe0'), true);
  assert.equal(isValidBinaryDeliverableHeader('photo.jpeg', '\xff\xd8\xff\xe0'), true);
  assert.equal(isValidBinaryDeliverableHeader('anim.gif', 'GIF89a..'), true);
});

test('validates webp only when the WEBP fourcc sits at byte 8 (needs 12 sampled bytes)', () => {
  assert.equal(isValidBinaryDeliverableHeader('img.webp', 'RIFF\x00\x00\x00\x00WEBP'), true);
  // A RIFF container that is not WEBP (e.g. a .wav) must fail; this only works
  // when the header sampler reads 12 bytes, guarding the prior 8-byte regression.
  assert.equal(isValidBinaryDeliverableHeader('img.webp', 'RIFF\x00\x00\x00\x00WAVE'), false);
});

test('validates mp4/mov via ftyp box and webm via EBML', () => {
  assert.equal(isValidBinaryDeliverableHeader('clip.mp4', '\x00\x00\x00\x18ftypmp42'), true);
  assert.equal(isValidBinaryDeliverableHeader('clip.mov', '\x00\x00\x00\x18ftypqt  '), true);
  assert.equal(isValidBinaryDeliverableHeader('clip.mp4', 'not a video!'), false);
  assert.equal(isValidBinaryDeliverableHeader('clip.webm', '\x1a\x45\xdf\xa3rest'), true);
  assert.equal(isValidBinaryDeliverableHeader('clip.webm', 'bad header!!'), false);
});

test('treats unsampled headers and unknown extensions as valid', () => {
  assert.equal(isValidBinaryDeliverableHeader('clip.mp4', ''), true);
  assert.equal(isValidBinaryDeliverableHeader('clip.mp4', undefined), true);
  assert.equal(isValidBinaryDeliverableHeader('notes.md', 'whatever text'), true);
});

test('flags undersized videos and stub pdfs only', () => {
  assert.equal(isUndersizedBinaryDeliverable('clip.mp4', VIDEO_MIN_BYTES - 1), true);
  assert.equal(isUndersizedBinaryDeliverable('clip.mp4', VIDEO_MIN_BYTES), false);
  assert.equal(isUndersizedBinaryDeliverable('clip.mov', 1024), true);
  assert.equal(isUndersizedBinaryDeliverable('clip.webm', 1024), true);
  assert.equal(isUndersizedBinaryDeliverable('report.pdf', PDF_MIN_BYTES - 1), true);
  assert.equal(isUndersizedBinaryDeliverable('report.pdf', PDF_MIN_BYTES), false);
  // Office/zip and images are not size-gated here; header integrity covers them.
  assert.equal(isUndersizedBinaryDeliverable('deck.pptx', 10), false);
  assert.equal(isUndersizedBinaryDeliverable('cover.png', 10), false);
});
