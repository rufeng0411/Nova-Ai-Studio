import { FileWarning } from 'lucide-react';

type FallbackPreviewAdapterProps = {
  message?: string;
};

export default function FallbackPreviewAdapter({
  message = '该文件暂不支持高级预览，请下载或在右栏查看。',
}: FallbackPreviewAdapterProps) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-card p-8 text-center">
      <div className="max-w-sm">
        <FileWarning className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <div className="text-sm text-muted-foreground">{message}</div>
      </div>
    </div>
  );
}
