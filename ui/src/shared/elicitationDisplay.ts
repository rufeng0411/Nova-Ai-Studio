import type { ChatMessage } from '../components/chat/types/types';
import { isInteractiveElicitationToolName } from './pendingElicitation';

export type ElicitationQuestion = {
  question: string;
  header?: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
};

function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== 'string' || !value.trim()) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeOption(option: unknown) {
  if (!option || typeof option !== 'object') return null;
  const raw = option as Record<string, unknown>;
  const label = typeof raw.label === 'string' ? raw.label : '';
  if (!label.trim()) return null;
  return {
    label,
    description: typeof raw.description === 'string' ? raw.description : undefined,
  };
}

export function normalizeElicitationQuestion(question: unknown): ElicitationQuestion | null {
  if (!question || typeof question !== 'object') return null;
  const raw = question as Record<string, unknown>;
  const text = [
    typeof raw.question === 'string' ? raw.question : '',
    typeof raw.header === 'string' ? raw.header : '',
    typeof raw.title === 'string' ? raw.title : '',
    typeof raw.prompt === 'string' ? raw.prompt : '',
  ].find((value) => value.trim()) ?? '';
  if (!text.trim()) return null;

  const options = Array.isArray(raw.options)
    ? raw.options
        .map(normalizeOption)
        .filter((option): option is NonNullable<ReturnType<typeof normalizeOption>> => Boolean(option))
    : [];

  const header = typeof raw.header === 'string' && raw.header.trim() ? raw.header : undefined;
  const questionText = typeof raw.question === 'string' && raw.question.trim()
    ? raw.question
    : text;

  return {
    question: questionText,
    header: header && header !== questionText ? header : undefined,
    options,
    multiSelect: Boolean(raw.multiSelect),
  };
}

export function normalizeElicitationQuestions(value: unknown): ElicitationQuestion[] {
  const parsed = parseJsonIfString(value);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(normalizeElicitationQuestion)
    .filter((question): question is ElicitationQuestion => Boolean(question));
}

export function normalizeElicitationAnswers(value: unknown): Record<string, string> {
  const parsed = parseJsonIfString(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>)
      .filter(([key]) => key.trim())
      .map(([key, answer]) => {
        if (Array.isArray(answer)) {
          return [key, answer.map((item) => String(item ?? '')).filter(Boolean).join(', ')];
        }
        return [key, typeof answer === 'string' ? answer : String(answer ?? '')];
      }),
  );
}

function parseToolInput(raw: unknown): Record<string, unknown> {
  const parsed = parseJsonIfString(raw);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

function questionLabel(question: ElicitationQuestion): string {
  return question.header?.trim() || question.question;
}

export function formatElicitationAnswersMarkdown(
  questionsInput: unknown,
  answersInput: Record<string, string | string[]>,
): string {
  const questions = normalizeElicitationQuestions(questionsInput);
  const answers = normalizeElicitationAnswers(answersInput);

  if (questions.length === 0) {
    const fallback = Object.values(answers).filter(Boolean);
    return fallback.join('、') || '';
  }

  if (questions.length === 1) {
    const question = questions[0];
    const answer = answers[question.question]?.trim();
    if (!answer) return '';
    if (questions.length === 1 && !question.header) {
      return answer;
    }
    return `**${questionLabel(question)}**\n\n${answer}`;
  }

  const lines = questions
    .map((question) => {
      const answer = answers[question.question]?.trim();
      if (!answer) return null;
      return `- **${questionLabel(question)}**：${answer}`;
    })
    .filter((line): line is string => Boolean(line));

  return lines.join('\n');
}

export function extractElicitationFromToolMessage(message: ChatMessage): {
  questions: ElicitationQuestion[];
  answers: Record<string, string>;
} | null {
  if (!message.isToolUse || !isInteractiveElicitationToolName(message.toolName)) {
    return null;
  }

  const input = parseToolInput(message.toolInput);
  const questions = normalizeElicitationQuestions(input.questions);
  if (questions.length === 0) return null;

  const resultRecord =
    message.toolResult && typeof message.toolResult === 'object'
      ? (message.toolResult as Record<string, unknown>)
      : null;
  const toolUseResult =
    resultRecord?.toolUseResult && typeof resultRecord.toolUseResult === 'object'
      ? (resultRecord.toolUseResult as Record<string, unknown>)
      : null;

  const answers = normalizeElicitationAnswers(input.answers ?? toolUseResult?.answers);
  return { questions, answers };
}

export function isAskUserQuestionToolName(toolName: string | undefined): boolean {
  return toolName === 'AskUserQuestion' || toolName === 'ask_user_question';
}

export function hasElicitationAnswers(answers: Record<string, string>): boolean {
  return Object.values(answers).some((value) => value.trim().length > 0);
}

/** Stale ask_user_question tool rows without user answers should not pollute the transcript. */
export function shouldHideUnansweredAskUserQuestionToolMessage(message: ChatMessage): boolean {
  if (!message.isToolUse || !isAskUserQuestionToolName(message.toolName)) {
    return false;
  }
  const extracted = extractElicitationFromToolMessage(message);
  if (!extracted) return true;
  return !hasElicitationAnswers(extracted.answers);
}
