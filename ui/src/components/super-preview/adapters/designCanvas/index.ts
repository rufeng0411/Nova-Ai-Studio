import { lazy } from 'react';

const DesignCanvasAdapter = lazy(
  () => import('./DesignCanvasAdapter'),
);

export default DesignCanvasAdapter;
