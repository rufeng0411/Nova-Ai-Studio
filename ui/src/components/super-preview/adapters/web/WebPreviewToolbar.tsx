import { Monitor, Smartphone } from 'lucide-react';
import { PreviewChromeGroup, PreviewChromeIconButton } from '../../PreviewChromeBar';
import { WEB_DEVICES, type WebPreviewControls } from './webPreviewControls';

type WebPreviewToolbarProps = {
  controls: WebPreviewControls;
};

export default function WebPreviewToolbar({ controls }: WebPreviewToolbarProps) {
  return (
    <PreviewChromeGroup aria-label="网页预览视口">
      {WEB_DEVICES.map((item) => {
        const Icon = item.id === 'desktop' ? Monitor : Smartphone;
        const active = controls.deviceId === item.id;
        return (
          <PreviewChromeIconButton
            key={item.id}
            active={active}
            title={item.label}
            aria-label={item.label}
            aria-pressed={active}
            onClick={() => controls.setDeviceId(item.id)}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </PreviewChromeIconButton>
        );
      })}
    </PreviewChromeGroup>
  );
}
