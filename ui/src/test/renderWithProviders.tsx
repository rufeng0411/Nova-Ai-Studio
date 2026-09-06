import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config.js';

type WrapperProps = { children: ReactNode };

function AllProviders({ children }: WrapperProps) {
 return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
 return render(ui, { wrapper: AllProviders, ...options });
}
