// PD-SAAS-FORK: persistent deliverable badge on sticky summary bar + completion pulse.

import { memo, forwardRef } from 'react';

import { CheckCircle2, ListChecks } from 'lucide-react';

import { cn } from '../../../lib/utils';



export type DeliverableSummaryBarBadgeProps = {

  done: number;

  total: number;

  aligning: boolean;

  className?: string;

};



const DeliverableSummaryBarBadge = forwardRef<HTMLDivElement, DeliverableSummaryBarBadgeProps>(

  function DeliverableSummaryBarBadge(

    { done, total, aligning, className },

    ref,

  ) {

    const hasProgress = !aligning && total > 0 && done > 0;

    const allComplete = !aligning && total > 0 && done >= total;



    return (

      <div

        ref={ref}

        className={cn(

          'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full',

          aligning

            ? 'bg-muted/45'

            : hasProgress

              ? allComplete

                ? 'bg-success/16 ring-1 ring-success/25'

                : 'bg-success/12 ring-1 ring-success/15'

              : 'bg-muted/40 ring-1 ring-border/40',

          className,

        )}

        data-testid="deliverable-summary-bar-badge"

        aria-hidden

      >

        {hasProgress ? (

          <CheckCircle2

            className={cn(

              'relative text-success',

              allComplete ? 'h-4 w-4' : 'h-3.5 w-3.5',

            )}

            strokeWidth={allComplete ? 2.25 : 2}

          />

        ) : (

          <ListChecks className="relative h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.75} />

        )}

      </div>

    );

  },

);



export default memo(DeliverableSummaryBarBadge, (prev, next) =>

  prev.done === next.done

  && prev.total === next.total

  && prev.aligning === next.aligning

  && prev.className === next.className,

);


