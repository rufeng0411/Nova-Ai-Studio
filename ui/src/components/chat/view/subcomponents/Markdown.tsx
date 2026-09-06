import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTranslation } from 'react-i18next';
import DeliverablePathLink from '../../deliverables/DeliverablePathLink';
import { normalizeInlineCodeFences } from '../../utils/chatFormatting';
import { copyTextToClipboard } from '../../../../utils/clipboard';
import {
 coerceDeliverablePathFromHref,
 isLikelyDeliverablePath,
 parsePilotdeckLink,
 parseProjectApiFileLink,
} from '../../../../shared/artifactPaths';
import { isSkillResourceUri } from '../../../../shared/skillResourcePaths';
import { api } from '../../../../utils/api';
import {
 MarkdownInteractionContext,
 type MarkdownInteractionContextValue,
} from './MarkdownInteractionContext';
import MarkdownHtmlPreview, { isRenderableHtmlDocument } from './MarkdownHtmlPreview';

type MarkdownProps = {
 children: React.ReactNode;
 className?: string;
 interaction?: MarkdownInteractionContextValue | null;
 /** When set, relative image paths are resolved via the project files API. */
 projectName?: string;
};

type CodeBlockProps = {
 node?: any;
 inline?: boolean;
 className?: string;
 children?: React.ReactNode;
};

const INLINE_DELIVERABLE_PATH_RE = /((?!https?:\/\/)[^\s`|<>()]+?\.(?:html?|md|markdown|pdf|pptx|docx|jsonld|json|png|jpe?g|webp|csv|xlsx))/gi;

function trimTrailingPunctuation(value: string): { path: string; suffix: string } {
 const match = value.match(/^(.*?)([，。；;、,.]*)$/);
 return {
 path: match?.[1] || value,
 suffix: match?.[2] || '',
 };
}

function linkifyTextNode(text: string): React.ReactNode[] {
 const parts: React.ReactNode[] = [];
 let lastIndex = 0;
 for (const match of text.matchAll(INLINE_DELIVERABLE_PATH_RE)) {
 const raw = match[0];
 const index = match.index ?? 0;
 if (index > lastIndex) parts.push(text.slice(lastIndex, index));
 const { path, suffix } = trimTrailingPunctuation(raw);
 parts.push(<DeliverablePathLink key={`${path}-${index}`} path={path}>{path}</DeliverablePathLink>);
 if (suffix) parts.push(suffix);
 lastIndex = index + raw.length;
 }
 if (lastIndex < text.length) parts.push(text.slice(lastIndex));
 return parts;
}

function linkifyPlainDeliverableText(children: React.ReactNode): React.ReactNode {
 return React.Children.map(children, (child) => {
 if (typeof child === 'string') return linkifyTextNode(child);
 if (!React.isValidElement(child)) return child;
 return child;
 });
}

const CodeBlock = ({ node, inline, className, children, ...props }: CodeBlockProps) => {
 const { t } = useTranslation('chat');
 const [copied, setCopied] = useState(false);
 const raw = Array.isArray(children) ? children.join('') : String(children ?? '');
 const trimmed = raw.trim();
 const looksMultiline = /[\r\n]/.test(raw);
 const inlineDetected = inline || (node && node.type === 'inlineCode');
 const shouldInline = inlineDetected || !looksMultiline;

 if (shouldInline && (isSkillResourceUri(trimmed) || isLikelyDeliverablePath(trimmed))) {
 return <DeliverablePathLink path={trimmed} />;
 }

 if (shouldInline) {
 return (
 <code
 className={`whitespace-pre-wrap break-words rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground dark:border-gray-700 dark:bg-card/60 ${className || ''
 }`}
 {...props}
 >
 {children}
 </code>
 );
 }

 const match = /language-(\w+)/.exec(className || '');
 const language = match ? match[1] : 'text';

 if (language === 'html' && isRenderableHtmlDocument(raw)) {
  return <MarkdownHtmlPreview html={raw} />;
 }

 return (
 <div className="group relative my-2">
 {language && language !== 'text' && (
 <div className="absolute left-3 top-2 z-10 text-xs font-medium uppercase text-gray-400">{language}</div>
 )}

 <button
 type="button"
 onClick={() =>
 copyTextToClipboard(raw).then((success) => {
 if (success) {
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 }
 })
 }
 className="absolute right-2 top-2 z-10 rounded-md border border-gray-600 bg-gray-700/80 px-2 py-1 text-xs text-primary-foreground opacity-0 transition-opacity hover:bg-gray-700 focus:opacity-100 active:opacity-100 group-hover:opacity-100"
 title={copied ? t('codeBlock.copied') : t('codeBlock.copyCode')}
 aria-label={copied ? t('codeBlock.copied') : t('codeBlock.copyCode')}
 >
 {copied ? (
 <span className="flex items-center gap-1">
 <svg className="h-3.5 w-3.5" viewBox="0 0" fill="currentColor">
 <path
 fillRule="evenodd"
 d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
 clipRule="evenodd"
 />
 </svg>
 {t('codeBlock.copied')}
 </span>
 ) : (
 <span className="flex items-center gap-1">
 <svg
 className="h-3.5 w-3.5"
 viewBox="0 0"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
 <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
 </svg>
 {t('codeBlock.copy')}
 </span>
 )}
 </button>

 <SyntaxHighlighter
 language={language}
 style={oneDark}
 customStyle={{
 margin: 0,
 borderRadius: '0.5rem',
 fontSize: '0.875rem',
 padding: language && language !== 'text' ? '2rem 1rem 1rem 1rem' : '1rem',
 }}
 codeTagProps={{
 style: {
 fontFamily:
 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
 },
 }}
 >
 {raw}
 </SyntaxHighlighter>
 </div>
 );
};

const LinkBlock = ({ href, children }: { href?: string; children?: React.ReactNode }) => {
 const hrefValue = String(href || '').trim();
 const pilotdeck = parsePilotdeckLink(hrefValue);
 if (pilotdeck) {
 return (
 <DeliverablePathLink path={hrefValue} action={pilotdeck.action}>
 {children}
 </DeliverablePathLink>
 );
 }
 // PD-SAAS-FORK: project preview/content API links should open in the right panel, not navigate away.
 const projectApi = parseProjectApiFileLink(hrefValue);
 if (projectApi) {
 return <DeliverablePathLink path={projectApi.filePath}>{children}</DeliverablePathLink>;
 }
 if (isSkillResourceUri(hrefValue)) {
 return <DeliverablePathLink path={hrefValue}>{children}</DeliverablePathLink>;
 }
 const deliverablePath = coerceDeliverablePathFromHref(hrefValue);
 if (deliverablePath) {
 return <DeliverablePathLink path={deliverablePath}>{children}</DeliverablePathLink>;
 }
 if (hrefValue && isLikelyDeliverablePath(hrefValue)) {
 return <DeliverablePathLink path={hrefValue}>{children}</DeliverablePathLink>;
 }
 if (/^https?:\/\//i.test(hrefValue)) {
 return (
 <a href={hrefValue} className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noopener noreferrer">
 {children}
 </a>
 );
 }
 // Relative non-file hrefs (e.g. mis-linked `/p/general`) must not reload the SPA.
 return <span className="text-blue-600 dark:text-blue-400">{children}</span>;
};

function resolveImageSrc(src: string | undefined, projectName: string | undefined): string | undefined {
 if (!src || !projectName) return src;
 if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) return src;
 const cleaned = src.replace(/^\.\//, '');
 return api.fileContentUrl(projectName, cleaned);
}

const baseMarkdownComponents = {
 code: CodeBlock,
 blockquote: ({ children }: { children?: React.ReactNode }) => (
 <blockquote className="my-2 border-l-4 border-border pl-4 italic text-muted-foreground dark:border-gray-600">
 {children}
 </blockquote>
 ),
 a: LinkBlock,
 p: ({ children }: { children?: React.ReactNode }) => (
 <div className="mb-2 last:mb-0">{linkifyPlainDeliverableText(children)}</div>
 ),
 table: ({ children }: { children?: React.ReactNode }) => (
 <div className="my-2 overflow-x-auto">
 <table className="min-w-full border-collapse border border-border dark:border-gray-700">{children}</table>
 </div>
 ),
 thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-muted dark:bg-card">{children}</thead>,
 th: ({ children }: { children?: React.ReactNode }) => (
 <th className="border border-border px-3 py-2 text-left text-sm font-semibold dark:border-gray-700">{linkifyPlainDeliverableText(children)}</th>
 ),
td: ({ children }: { children?: React.ReactNode }) => (
<td className="border border-border px-3 py-2 align-top text-sm dark:border-gray-700">{linkifyPlainDeliverableText(children)}</td>
),
 li: ({ children }: { children?: React.ReactNode }) => <li>{linkifyPlainDeliverableText(children)}</li>,
};

export function Markdown({ children, className, interaction = null, projectName }: MarkdownProps) {
 const content = normalizeInlineCodeFences(String(children ?? ''));
 const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
 const rehypePlugins = useMemo(() => [rehypeKatex], []);

 const components = useMemo(() => {
 if (!projectName) return baseMarkdownComponents;
 return {
 ...baseMarkdownComponents,
 img: ({ src, alt, ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) => (
 <img
 src={resolveImageSrc(src, projectName)}
 alt={alt || ''}
 className="my-2 max-w-full rounded-lg"
 loading="lazy"
 decoding="async"
 {...rest}
 />
 ),
 };
 }, [projectName]);

 return (
 <MarkdownInteractionContext.Provider value={interaction}>
 <div className={className}>
 <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components as any}>
 {content}
 </ReactMarkdown>
 </div>
 </MarkdownInteractionContext.Provider>
 );
}
