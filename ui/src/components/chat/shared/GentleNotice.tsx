import { Loader2 } from 'lucide-react';

export type GentleNoticeProps = {
 /** Single-line public message — keep short. */
 summary: string;
 /** Always-visible guidance lines (e.g. exhausted recovery hints). */
 hints?: string[];
 /** Collapsed detail (technical text). Omit to hide expand. */
 expandDetail?: string | null;
 expandLabel?: string;
 /** Subtle spinner for in-progress recovery. */
 showSpinner?: boolean;
 className?: string;
 children?: React.ReactNode;
};

export function GentleNotice({
 summary,
 hints,
 expandDetail,
 expandLabel = '查看详情',
 showSpinner = false,
 className = '',
 children,
}: GentleNoticeProps) {
 const detail = expandDetail?.trim();
 const visibleHints = (hints ?? []).map((hint) => hint.trim()).filter(Boolean);

 return (
 <div
 className={`text-[12px] leading-relaxed text-muted-foreground ${className}`}
 role="status"
 aria-live="polite"
 >
 <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
 {showSpinner ? (
 <Loader2 className="h-3 w-3 shrink-0 animate-spin opacity-35" strokeWidth={2} aria-hidden />
 ) : null}
 <span className={visibleHints.length > 0 ? 'font-medium text-foreground/85' : undefined}>{summary}</span>
 {detail ? (
 <details className="inline [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden">
 <summary className="inline cursor-pointer select-none opacity-70 hover:opacity-100">
 {expandLabel}
 </summary>
 <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/60 px-2 py-1.5 text-[11px] text-muted-foreground /40">
 {detail}
 </pre>
 </details>
 ) : null}
 </div>
 {visibleHints.length > 0 ? (
 <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-foreground/80">
 {visibleHints.map((hint) => (
 <li key={hint}>{hint}</li>
 ))}
 </ul>
 ) : null}
 {children ? <div className="mt-2">{children}</div> : null}
 </div>
 );
}

export default GentleNotice;
