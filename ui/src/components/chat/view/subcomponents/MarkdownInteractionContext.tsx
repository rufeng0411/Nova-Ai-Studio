import { createContext, useContext } from 'react';
import type { Project } from '../../../../types/app';

export type MarkdownInteractionContextValue = {
 selectedProject?: Project | null;
 projectRoot?: string;
 onFileOpen?: (filePath: string) => void;
 /** PD-SAAS-FORK: turn-scoped artifact directory for deliverable link resolve */
 turnArtifactDir?: string;
};

export const MarkdownInteractionContext = createContext<MarkdownInteractionContextValue | null>(null);

export function useMarkdownInteraction(): MarkdownInteractionContextValue | null {
 return useContext(MarkdownInteractionContext);
}
