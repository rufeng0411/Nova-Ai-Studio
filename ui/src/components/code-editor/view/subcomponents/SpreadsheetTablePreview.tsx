type SpreadsheetTablePreviewProps = {
 rows: string[][];
 emptyLabel?: string;
};

export function SpreadsheetTablePreview({ rows, emptyLabel = '空表格' }: SpreadsheetTablePreviewProps) {
 if (rows.length === 0) {
 return (
 <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
 {emptyLabel}
 </div>
 );
 }

 const [header, ...body] = rows;
 const colCount = Math.max(...rows.map((row) => row.length));

 return (
 <div className="h-full overflow-auto bg-card p-4">
 <table className="min-w-full border-collapse text-left text-[12px]">
 <thead>
 <tr className="border-b border-border bg-sidebar">
 {Array.from({ length: colCount }, (_, colIdx) => (
 <th
 key={`h-${colIdx}`}
 className="whitespace-nowrap px-3 py-2 font-medium text-foreground"
 >
 {header?.[colIdx] ?? ''}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {body.map((row, rowIdx) => (
 <tr key={`r-${rowIdx}`} className="border-b border-border">
 {Array.from({ length: colCount }, (_, colIdx) => (
 <td
 key={`c-${rowIdx}-${colIdx}`}
 className="whitespace-nowrap px-3 py-1.5 text-foreground"
 >
 {row[colIdx] ?? ''}
 </td>
 ))}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}

export default SpreadsheetTablePreview;
