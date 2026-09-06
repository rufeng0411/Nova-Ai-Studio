// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n/config.js';
import MessageRowV2 from './MessageRowV2';
import type { ChatMessage } from '../chat/types/types';

function renderRow(message: ChatMessage) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MessageRowV2
        message={message}
        prevMessage={null}
        provider="pilotdeck"
        selectedProject={{ name: 'general', path: '/tmp/general', fullPath: '/tmp/general' } as never}
        createDiff={() => []}
      />
    </I18nextProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe('MessageRowV2 user bubble', () => {
  it('renders user prompt as plain text without deliverable path links', () => {
    const prompt = '用「原生可编辑 PPT」帮我：【雷蛇灵刃2026】。须交付：presentation.pptx (8-10 页可编辑 PPT)。';
    renderRow({
      id: 'u1',
      type: 'user',
      content: prompt,
      timestamp: Date.now(),
    });

    expect(screen.getByText(prompt)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /presentation\.pptx/i })).toBeNull();
  });
});
