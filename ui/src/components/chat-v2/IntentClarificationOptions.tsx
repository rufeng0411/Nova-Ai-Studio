import { useTranslation } from 'react-i18next';

export type IntentClarificationOption = {
  id: 'dialogue' | 'execute';
  label: string;
};

export type IntentClarificationOptionsProps = {
  options: IntentClarificationOption[];
  onSelect: (option: IntentClarificationOption) => void;
  className?: string;
};

export function IntentClarificationOptions({
  options,
  onSelect,
  className = '',
}: IntentClarificationOptionsProps) {
  const { t } = useTranslation('chat');
  if (!options.length) return null;

  return (
    <div className={`mt-3 flex flex-wrap gap-2 ${className}`.trim()} data-testid="intent-clarification-options">
      {options.slice(0, 2).map((option) => (
        <button
          key={option.id}
          type="button"
          title={option.label}
          onClick={() => onSelect(option)}
          className="rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-[13px] text-foreground transition hover:border-primary/40 hover:bg-primary/5"
        >
          {option.label}
        </button>
      ))}
      <span className="sr-only">{t('intentClarification.hint', { defaultValue: '也可以直接在输入框回复' })}</span>
    </div>
  );
}
