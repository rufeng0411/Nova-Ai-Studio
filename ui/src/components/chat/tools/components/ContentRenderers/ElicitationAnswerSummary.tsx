import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import {
  normalizeElicitationAnswers,
  normalizeElicitationQuestions,
  type ElicitationQuestion,
} from '../../../../../shared/elicitationDisplay';

type ElicitationAnswerSummaryProps = {
  questions: unknown;
  answers: unknown;
  className?: string;
  variant?: 'process' | 'compact';
};

function questionLabel(question: ElicitationQuestion): string {
  return question.header?.trim() || question.question;
}

export const ElicitationAnswerSummary: React.FC<ElicitationAnswerSummaryProps> = ({
  questions,
  answers,
  className = '',
  variant = 'process',
}) => {
  const { t } = useTranslation('chat');
  const normalizedQuestions = normalizeElicitationQuestions(questions);
  const normalizedAnswers = normalizeElicitationAnswers(answers);
  const answeredItems = normalizedQuestions
    .map((question) => ({
      question,
      answer: normalizedAnswers[question.question]?.trim() ?? '',
    }))
    .filter((item) => item.answer.length > 0);

  if (answeredItems.length === 0) {
    return null;
  }

  const isCompact = variant === 'compact';

  return (
    <div
      className={`rounded-xl border border-border/70 bg-muted/40 px-3.5 py-3 dark:bg-card/40 ${
        isCompact ? 'text-[12px]' : 'text-[13px]'
      } ${className}`}
    >
      <div className="mb-2 flex items-center gap-2 text-foreground">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </span>
        <span className="font-medium">
          {t('elicitation.yourChoices', { defaultValue: '你的选择' })}
        </span>
      </div>

      <div className="space-y-2.5">
        {answeredItems.map(({ question, answer }) => {
          const labels = answer.split(', ').filter(Boolean);
          return (
            <div key={question.question} className="min-w-0">
              <div className="text-[11px] leading-snug text-muted-foreground">
                {questionLabel(question)}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {labels.map((label) => {
                  const isCustom = !question.options.some((option) => option.label === label);
                  return (
                    <span
                      key={`${question.question}-${label}`}
                      className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-foreground"
                    >
                      {label}
                      {isCustom ? (
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {t('elicitation.customOption', { defaultValue: '自定义' })}
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
