import { describe, expect, it } from 'vitest';
import zhChat from '../i18n/locales/zh-CN/chat.json';
import enChat from '../i18n/locales/en/chat.json';

describe('hfStudio i18n', () => {
  it('zh-CN has core hfStudio keys', () => {
    expect(zhChat.hfStudio?.save).toBeTruthy();
    expect(zhChat.hfStudio?.unsavedConfirm).toBeTruthy();
    expect(zhChat.hfStudio?.view?.promoPreview).toBeTruthy();
  });

  it('en has core hfStudio keys', () => {
    expect(enChat.hfStudio?.save).toBeTruthy();
    expect(enChat.hfStudio?.unsavedConfirm).toBeTruthy();
  });
});
