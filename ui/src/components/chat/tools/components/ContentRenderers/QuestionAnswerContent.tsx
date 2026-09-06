import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  normalizeElicitationAnswers,
  normalizeElicitationQuestions,
} from '../../../../../shared/elicitationDisplay';
import type { Question } from '../../../types/types';

interface QuestionAnswerContentProps {
  questions: unknown;
  answers: unknown;
  className?: string;
}

function toRenderableQuestions(value: unknown): Question[] {
  return normalizeElicitationQuestions(value) as Question[];
}

function resolveAnswerForQuestion(
  answers: Record<string, string>,
  question: Question,
): string | undefined {
  const direct = answers[question.question]?.trim();
  if (direct) return direct;
  if (question.header) {
    const byHeader = answers[question.header]?.trim();
    if (byHeader) return byHeader;
  }
  return undefined;
}

// Exception to the stateless ContentRenderer pattern: multi-question navigation requires local state.
export const QuestionAnswerContent: React.FC<QuestionAnswerContentProps> = ({
  questions,
  answers,
  className = '',
}) => {
  const { t } = useTranslation('chat');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const normalizedQuestions = toRenderableQuestions(questions);
  const normalizedAnswers = normalizeElicitationAnswers(answers);

  if (normalizedQuestions.length === 0) {
    return null;
  }

  const hasAnyAnswer = Object.keys(normalizedAnswers).length > 0;
  const total = normalizedQuestions.length;

  return (
    <div className={`space-y-2 ${className}`}>
      {normalizedQuestions.map((q, idx) => {
        const answer = resolveAnswerForQuestion(normalizedAnswers, q);
        const answerLabels = answer ? answer.split(', ') : [];
        const skipped = !answer;
        const isExpanded = expandedIdx === idx;

        return (
          <div
            key={idx}
            className="border-gray-150 overflow-hidden rounded-lg border bg-muted/50 dark:border-gray-700/50 dark:bg-card/30"
          >
            <button
              type="button"
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
              className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted dark:hover:bg-card/50"
            >
              <div className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                answerLabels.length > 0
                  ? 'bg-blue-100 dark:bg-blue-900/40'
                  : 'bg-muted dark:bg-card'
              }`}>
                {answerLabels.length > 0 ? (
                  <svg className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {q.header && (
                    <span className="inline-flex items-center rounded border border-blue-100/80 bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-600 dark:border-blue-800/40 dark:bg-blue-900/30 dark:text-blue-400">
                      {q.header}
                    </span>
                  )}
                  {total > 1 && (
                    <span className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                      {idx + 1}/{total}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {q.question}
                </div>

                {!isExpanded && answerLabels.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {answerLabels.map((lbl) => {
                      const isCustom = !q.options.some((o) => o.label === lbl);
                      return (
                        <span
                          key={lbl}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-info dark:bg-blue-900/30"
                        >
                          {lbl}
                          {isCustom && (
                            <span className="text-[9px] font-normal text-blue-400 dark:text-blue-500">(custom)</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}

                {!isExpanded && skipped && hasAnyAnswer && (
                  <span className="mt-1 inline-block text-[10px] italic text-gray-400 dark:text-gray-500">
                    {t('toolDisplay.questionSkipped', { defaultValue: '已跳过' })}
                  </span>
                )}
              </div>

              <svg
                className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400 transition-transform duration-200 dark:text-gray-500 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
                fill="none" stroke="currentColor" viewBox="0 0" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 px-3 pb-2.5 pt-0.5 dark:border-gray-700/40">
                <div className="ml-6.5 space-y-1">
                  {q.options.map((opt) => {
                    const wasSelected = answerLabels.includes(opt.label);
                    return (
                      <div
                        key={opt.label}
                        className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[12px] ${
                          wasSelected
                            ? 'border border-blue-200/60 bg-blue-50/80 dark:border-blue-800/40 dark:bg-blue-900/20'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        <div className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${q.multiSelect ? 'rounded-[3px]' : 'rounded-full'} flex items-center justify-center border-[1.5px] ${
                          wasSelected
                            ? 'border-blue-500 bg-primary dark:border-blue-400 dark:bg-primary'
                            : 'border-border dark:border-gray-600'
                        }`}>
                          {wasSelected && (
                            <svg className="h-2 w-2 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={wasSelected ? 'font-medium text-foreground ' : ''}>
                            {opt.label}
                          </span>
                          {opt.description && (
                            <span className={`mt-0.5 block text-[11px] ${
                              wasSelected ? 'text-info/70' : 'text-muted-foreground'
                            }`}>
                              {opt.description}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {answerLabels.filter((lbl) => !q.options.some((o) => o.label === lbl)).map((lbl) => (
                    <div
                      key={lbl}
                      className="flex items-start gap-2 rounded-lg border border-blue-200/60 bg-blue-50/80 px-2.5 py-1.5 text-[12px] dark:border-blue-800/40 dark:bg-blue-900/20"
                    >
                      <div className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${q.multiSelect ? 'rounded-[3px]' : 'rounded-full'} flex items-center justify-center border-[1.5px] border-blue-500 bg-primary dark:border-blue-400 dark:bg-primary`}>
                        <svg className="h-2 w-2 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">{lbl}</span>
                        <span className="ml-1 text-[10px] text-blue-500 dark:text-blue-400">(custom)</span>
                      </div>
                    </div>
                  ))}

                  {skipped && hasAnyAnswer && (
                    <div className="px-2.5 py-1 text-[11px] italic text-gray-400 dark:text-gray-500">
                      {t('toolDisplay.questionNoAnswer', { defaultValue: '未作答' })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!hasAnyAnswer && total === 1 && (
        <div className="text-[11px] italic text-gray-400 dark:text-gray-500">
          {t('toolDisplay.questionSkipped', { defaultValue: '已跳过' })}
        </div>
      )}
    </div>
  );
};
