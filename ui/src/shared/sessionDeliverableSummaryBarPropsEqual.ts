/** PD-SAAS-FORK: shallow compare for sticky summary bar — skip re-render when visible row state unchanged. */

import type { DeliverableDockRow } from './buildDeliverableDockRows';



type SummaryBarComparableProps = {

  rows: DeliverableDockRow[];

  contractHash?: string | null;

  validationSettled?: boolean;

  isRepairActive?: boolean;

  taskMarkedComplete?: boolean;

  isMobile?: boolean;

  turnArtifactDir?: string | null;

  scopeDir?: string | null;

};



function rowsVisuallyEqual(a: DeliverableDockRow[], b: DeliverableDockRow[]): boolean {

  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {

    const left = a[i];

    const right = b[i];

    if (left.id !== right.id) return false;

    if (left.status !== right.status) return false;

    if (left.label !== right.label) return false;

    if ((left.resolvedPath ?? '') !== (right.resolvedPath ?? '')) return false;

  }

  return true;

}



export function sessionDeliverableSummaryBarPropsEqual(

  prev: SummaryBarComparableProps,

  next: SummaryBarComparableProps,

): boolean {

  return prev.contractHash === next.contractHash

    && prev.validationSettled === next.validationSettled

    && prev.isRepairActive === next.isRepairActive

    && prev.taskMarkedComplete === next.taskMarkedComplete

    && prev.isMobile === next.isMobile

    && prev.turnArtifactDir === next.turnArtifactDir

    && prev.scopeDir === next.scopeDir

    && rowsVisuallyEqual(prev.rows, next.rows);

}


