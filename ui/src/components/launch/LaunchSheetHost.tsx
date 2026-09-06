// PD-SAAS-FORK: global LaunchSheet host
import { useEffect, useState } from 'react';
import LaunchSheet from './LaunchSheet.js';
import { subscribeLaunchSheet, type LaunchSheetRequest } from '../../shared/launchSheetBridge.js';

export default function LaunchSheetHost() {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<LaunchSheetRequest | null>(null);

  useEffect(() => {
    return subscribeLaunchSheet((next) => {
      setRequest(next);
      setOpen(true);
    });
  }, []);

  return (
    <LaunchSheet
      open={open}
      request={request}
      onClose={() => {
        setOpen(false);
        setRequest(null);
      }}
    />
  );
}
