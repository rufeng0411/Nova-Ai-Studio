import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { loadProjectTextContent } from '../../../../shared/loadProjectTextContent';
import { cn } from '../../../../lib/utils';
import { api } from '../../../../utils/api';
import { isXlsxFile } from '../../../code-editor/utils/binaryFile';
import SpreadsheetTablePreview from '../../../code-editor/view/subcomponents/SpreadsheetTablePreview';
import FallbackPreviewAdapter from '../fallback/FallbackPreviewAdapter';
import { parseDelimitedPreviewRows, type SpreadsheetSheet } from './spreadsheetPreviewUtils';

export function SpreadsheetSheetsPreview({ sheets }: { sheets: SpreadsheetSheet[] }) {
  const [activeSheet, setActiveSheet] = useState(0);
  const current = sheets[activeSheet]?.rows ?? [];
  return (
    <div className="flex h-full min-h-0 flex-col">
      {sheets.length > 1 ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-background px-2 py-1.5">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              type="button"
              className={cn(
                'rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground',
                index === activeSheet && 'bg-muted text-foreground',
              )}
              onClick={() => setActiveSheet(index)}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <SpreadsheetTablePreview rows={current} emptyLabel="空表格" />
      </div>
    </div>
  );
}

type SpreadsheetPreviewAdapterProps = {
  projectName: string;
  apiPath: string;
  fileName: string;
  projectRoot?: string;
};

export default function SpreadsheetPreviewAdapter({
  projectName,
  apiPath,
  fileName,
  projectRoot,
}: SpreadsheetPreviewAdapterProps) {
  const [sheets, setSheets] = useState<SpreadsheetSheet[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    const isExcel = isXlsxFile(fileName) || fileName.toLowerCase().endsWith('.xls');
    const promise = isExcel
      ? api.readFileBlob(projectName, apiPath)
        .then((response: Response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .then((buffer) => {
          const workbook = XLSX.read(buffer, { type: 'array' });
          return workbook.SheetNames.map((name) => ({
            name,
            rows: XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], { header: 1, defval: '' }) as string[][],
          }));
        })
      : loadProjectTextContent(projectName, apiPath, projectRoot).then((text) => [{
        name: 'Sheet 1',
        rows: parseDelimitedPreviewRows(text, fileName.toLowerCase().endsWith('.tsv') ? '\t' : ','),
      }]);

    promise
      .then((nextSheets) => {
        if (!cancelled) setSheets(nextSheets);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apiPath, fileName, projectName, projectRoot]);

  if (error) return <FallbackPreviewAdapter message="表格预览加载失败，请下载后查看。" />;
  return <SpreadsheetSheetsPreview sheets={sheets} />;
}
