import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, KeyboardEvent, RefObject, SetStateAction } from 'react';
import { api } from '../../../utils/api';
import { isImeEnterEvent } from '../../../utils/ime';
import type { Project } from '../../../types/app';
import {
  isValidReferencePath,
  normalizeReferencePath,
  splitPromptAndLegacyReferencePaths,
} from '../../../shared/fileReferenceComposer';

interface ProjectFileNode {
  name: string;
  type: 'file' | 'directory';
  path?: string;
  children?: ProjectFileNode[];
}

export interface MentionableFile {
  name: string;
  path: string;
  relativePath?: string;
}

interface UseFileMentionsOptions {
  selectedProject: Project | null;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  applyIntentComposerInput?: (prompt: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
}

const flattenFileTree = (files: ProjectFileNode[], basePath = ''): MentionableFile[] => {
  let flattened: MentionableFile[] = [];

  files.forEach((file) => {
    const fullPath = basePath ? `${basePath}/${file.name}` : file.name;
    if (file.type === 'directory' && file.children) {
      flattened = flattened.concat(flattenFileTree(file.children, fullPath));
      return;
    }

    if (file.type === 'file') {
      flattened.push({
        name: file.name,
        path: fullPath,
        relativePath: file.path,
      });
    }
  });

  return flattened;
};

function uniqueReferencePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of paths) {
    const path = normalizeReferencePath(raw);
    if (!isValidReferencePath(path) || seen.has(path.toLowerCase())) continue;
    seen.add(path.toLowerCase());
    ordered.push(path);
  }
  return ordered;
}

export function useFileMentions({
  selectedProject,
  input,
  setInput,
  applyIntentComposerInput: parentApplyIntentComposerInput,
  textareaRef,
}: UseFileMentionsOptions) {
  const [fileList, setFileList] = useState<MentionableFile[]>([]);
  const [fileReferences, setFileReferences] = useState<string[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<MentionableFile[]>([]);
  const [showFileDropdown, setShowFileDropdown] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [atSymbolPosition, setAtSymbolPosition] = useState(-1);

  const inFlightFetchRef = useRef<AbortController | null>(null);
  const legacySplitDoneRef = useRef(false);

  /** Hub 试一下 / 流程模板预填：清空旧 @ 引用，禁止把模板正文拆成附件。 */
  const applyIntentComposerInput = useCallback(
    (prompt: string) => {
      setFileReferences([]);
      legacySplitDoneRef.current = true;
      parentApplyIntentComposerInput?.(prompt);
    },
    [parentApplyIntentComposerInput],
  );

  const fetchProjectFiles = useCallback(async () => {
    const projectName = selectedProject?.name;
    if (!projectName) {
      setFileList([]);
      setFilteredFiles([]);
      return;
    }

    inFlightFetchRef.current?.abort();
    const abortController = new AbortController();
    inFlightFetchRef.current = abortController;

    try {
      const response = await api.getFiles(projectName, { signal: abortController.signal });
      if (!response.ok) {
        return;
      }
      const files = (await response.json()) as ProjectFileNode[];
      if (abortController.signal.aborted) {
        return;
      }
      setFileList(flattenFileTree(files));
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        return;
      }
      console.error('Error fetching files:', error);
    } finally {
      if (inFlightFetchRef.current === abortController) {
        inFlightFetchRef.current = null;
      }
    }
  }, [selectedProject?.name]);

  useEffect(() => {
    setFileList([]);
    setFilteredFiles([]);
    setFileReferences([]);
    legacySplitDoneRef.current = false;
    fetchProjectFiles();
    return () => {
      inFlightFetchRef.current?.abort();
    };
  }, [fetchProjectFiles]);

  useEffect(() => {
    if (legacySplitDoneRef.current) return;
    const { prompt, paths } = splitPromptAndLegacyReferencePaths(input);
    if (paths.length === 0) {
      legacySplitDoneRef.current = true;
      return;
    }
    legacySplitDoneRef.current = true;
    setFileReferences((previous) => uniqueReferencePaths([...previous, ...paths]));
    if (prompt !== input) {
      setInput(prompt);
      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        const end = prompt.length;
        textareaRef.current.setSelectionRange(end, end);
      });
    }
  }, [input, setInput, textareaRef]);

  const wasDropdownOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = wasDropdownOpenRef.current;
    wasDropdownOpenRef.current = showFileDropdown;
    if (!wasOpen && showFileDropdown) {
      fetchProjectFiles();
    }
  }, [showFileDropdown, fetchProjectFiles]);

  useEffect(() => {
    const textBeforeCursor = input.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) {
      setShowFileDropdown(false);
      setAtSymbolPosition(-1);
      return;
    }

    const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
    if (textAfterAt.includes(' ')) {
      setShowFileDropdown(false);
      setAtSymbolPosition(-1);
      return;
    }

    setAtSymbolPosition(lastAtIndex);
    setShowFileDropdown(true);
    setSelectedFileIndex(-1);

    const matchingFiles = fileList
      .filter(
        (file) =>
          file.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          file.path.toLowerCase().includes(textAfterAt.toLowerCase()),
      )
      .slice(0, 10);

    setFilteredFiles(matchingFiles);
  }, [input, cursorPosition, fileList]);

  const activeFileMentionPaths = useMemo(
    () => uniqueReferencePaths(fileReferences),
    [fileReferences],
  );

  const addReferencePaths = useCallback((paths: string[]) => {
    const normalized = uniqueReferencePaths(paths);
    if (normalized.length === 0) return;
    setFileReferences((previous) => uniqueReferencePaths([...previous, ...normalized]));
  }, []);

  const removeFileReference = useCallback((path: string) => {
    const key = normalizeReferencePath(path).toLowerCase();
    setFileReferences((previous) =>
      previous.filter((entry) => normalizeReferencePath(entry).toLowerCase() !== key),
    );
  }, []);

  const selectFile = useCallback(
    (file: MentionableFile) => {
      const textBeforeAt = input.slice(0, atSymbolPosition);
      const textAfterAtQuery = input.slice(atSymbolPosition);
      const spaceIndex = textAfterAtQuery.indexOf(' ');
      const textAfterQuery = spaceIndex !== -1 ? textAfterAtQuery.slice(spaceIndex) : '';
      const newInput = `${textBeforeAt}${textAfterQuery}`.replace(/^\s+/, '');
      const newCursorPosition = textBeforeAt.length;

      if (textareaRef.current && !textareaRef.current.matches(':focus')) {
        textareaRef.current.focus();
      }

      setInput(newInput);
      setCursorPosition(newCursorPosition);
      addReferencePaths([file.path]);

      setShowFileDropdown(false);
      setAtSymbolPosition(-1);

      if (!textareaRef.current) {
        return;
      }

      requestAnimationFrame(() => {
        if (!textareaRef.current) {
          return;
        }
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
        if (!textareaRef.current.matches(':focus')) {
          textareaRef.current.focus();
        }
      });
    },
    [input, atSymbolPosition, textareaRef, setInput, addReferencePaths],
  );

  const setPromptWithReferences = useCallback(
    (prompt: string, paths: string[]) => {
      const trimmed = prompt.trim();
      const normalized = uniqueReferencePaths(paths);
      if (!trimmed && normalized.length === 0) {
        return;
      }

      if (applyIntentComposerInput) {
        applyIntentComposerInput(trimmed);
      } else {
        setInput(trimmed);
      }
      setFileReferences(normalized);
      setCursorPosition(trimmed.length);
      setShowFileDropdown(false);
      setAtSymbolPosition(-1);
      legacySplitDoneRef.current = true;

      requestAnimationFrame(() => {
        if (!textareaRef.current) {
          return;
        }
        const end = trimmed.length;
        textareaRef.current.setSelectionRange(end, end);
        if (!textareaRef.current.matches(':focus')) {
          textareaRef.current.focus();
        }
      });
    },
    [applyIntentComposerInput, setInput, textareaRef],
  );

  const addFileReferences = useCallback(
    (paths: string[]) => {
      addReferencePaths(paths);
      setShowFileDropdown(false);
      setAtSymbolPosition(-1);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [addReferencePaths, textareaRef],
  );

  const handleFileMentionsKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!showFileDropdown || filteredFiles.length === 0) {
        return false;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedFileIndex((previousIndex) =>
          previousIndex < filteredFiles.length - 1 ? previousIndex + 1 : 0,
        );
        return true;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedFileIndex((previousIndex) =>
          previousIndex > 0 ? previousIndex - 1 : filteredFiles.length - 1,
        );
        return true;
      }

      if (event.key === 'Tab' || event.key === 'Enter') {
        if (isImeEnterEvent(event)) {
          return false;
        }
        event.preventDefault();
        if (selectedFileIndex >= 0) {
          selectFile(filteredFiles[selectedFileIndex]);
        } else if (filteredFiles.length > 0) {
          selectFile(filteredFiles[0]);
        }
        return true;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setShowFileDropdown(false);
        return true;
      }

      return false;
    },
    [showFileDropdown, filteredFiles, selectedFileIndex, selectFile],
  );

  return {
    showFileDropdown,
    filteredFiles,
    selectedFileIndex,
    activeFileMentionPaths,
    selectFile,
    addFileReferences,
    setPromptWithReferences,
    removeFileReference,
    clearFileMentions: () => setFileReferences([]),
    applyIntentComposerInput,
    setCursorPosition,
    handleFileMentionsKeyDown,
  };
}
