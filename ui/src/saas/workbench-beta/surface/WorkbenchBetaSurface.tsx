// PD-SAAS-FORK: Beta surface context — Provider 外 active=false（/app 零新 DOM）

import { createContext, useContext, type ReactNode } from 'react';

export type WorkbenchBetaSurfaceValue = {
  active: boolean;
};

const WorkbenchBetaSurfaceContext = createContext<WorkbenchBetaSurfaceValue>({
  active: false,
});

export function WorkbenchBetaSurfaceProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <WorkbenchBetaSurfaceContext.Provider value={{ active: active === true }}>
      <div className="wb-beta-surface-fill min-h-0 h-full flex-1 flex flex-col">{children}</div>
    </WorkbenchBetaSurfaceContext.Provider>
  );
}

export function useWorkbenchBetaSurface(): WorkbenchBetaSurfaceValue {
  return useContext(WorkbenchBetaSurfaceContext);
}
