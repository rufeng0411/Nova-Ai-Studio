import { useMemo, useState } from 'react';

/** Sidebar web preview: desktop full width vs mobile PWA viewport only. */
export const WEB_DEVICES = [
  { id: 'desktop', label: '电脑版', className: 'w-full max-w-[1280px]' },
  { id: 'mobile', label: '手机版', className: 'w-[390px] max-w-full' },
] as const;

export type WebDeviceId = (typeof WEB_DEVICES)[number]['id'];

export type WebPreviewControls = {
  deviceId: WebDeviceId;
  setDeviceId: (id: WebDeviceId) => void;
  refreshKey: number;
  refresh: () => void;
  src: string;
  deviceClassName: string;
};

export function useWebPreviewControls(previewUrl: string): WebPreviewControls {
  const [deviceId, setDeviceId] = useState<WebDeviceId>('desktop');
  const [refreshKey, setRefreshKey] = useState(0);
  const device = WEB_DEVICES.find((item) => item.id === deviceId) ?? WEB_DEVICES[0];
  const src = useMemo(() => {
    if (!previewUrl) return '';
    const separator = previewUrl.includes('?') ? '&' : '?';
    return `${previewUrl}${separator}_sp=${refreshKey}`;
  }, [previewUrl, refreshKey]);

  return {
    deviceId,
    setDeviceId,
    refreshKey,
    refresh: () => setRefreshKey((current) => current + 1),
    src,
    deviceClassName: device.className,
  };
}
