// PD-SAAS-FORK: optional weak stage progress rail for long-running task templates
export type StageProgressRailProps = {
  stages?: string[];
  currentIndex?: number;
  className?: string;
};

export function StageProgressRail({
  stages,
  currentIndex = 0,
  className = '',
}: StageProgressRailProps) {
  if (!stages?.length) return null;
  return (
    <div
      className={`flex flex-wrap items-center gap-1 px-4 py-1 text-[11px] text-muted-foreground ${className}`}
      role="navigation"
      aria-label="Task stages"
    >
      {stages.map((stage, index) => (
        <span
          key={stage}
          className={index === currentIndex ? 'font-semibold text-foreground' : undefined}
        >
          {stage}
          {index < stages.length - 1 ? <span aria-hidden="true"> · </span> : null}
        </span>
      ))}
    </div>
  );
}

export default StageProgressRail;
