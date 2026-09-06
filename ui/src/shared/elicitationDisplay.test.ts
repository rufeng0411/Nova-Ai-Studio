import { describe, expect, it } from 'vitest';
import {
  extractElicitationFromToolMessage,
  formatElicitationAnswersMarkdown,
  hasElicitationAnswers,
  normalizeElicitationAnswers,
  normalizeElicitationQuestions,
  shouldHideUnansweredAskUserQuestionToolMessage,
} from './elicitationDisplay';

describe('formatElicitationAnswersMarkdown', () => {
  const questions = [
    {
      question: '你希望网站是什么风格？',
      header: '网站风格',
      options: [{ label: '现代简约', description: '' }, { label: '复古', description: '' }],
    },
    {
      question: '主色调偏好？',
      header: '主色调',
      options: [{ label: '蓝色系', description: '' }, { label: '暖色', description: '' }],
    },
  ];

  it('formats multiple questions as markdown list', () => {
    const text = formatElicitationAnswersMarkdown(questions, {
      '你希望网站是什么风格？': '现代简约',
      '主色调偏好？': '蓝色系',
    });
    expect(text).toContain('**网站风格**：现代简约');
    expect(text).toContain('**主色调**：蓝色系');
  });

  it('formats a single question as a short block', () => {
    const text = formatElicitationAnswersMarkdown([questions[0]], {
      '你希望网站是什么风格？': '现代简约',
    });
    expect(text).toBe('**网站风格**\n\n现代简约');
  });

  it('joins multi-select answers', () => {
    const text = formatElicitationAnswersMarkdown([questions[0]], {
      '你希望网站是什么风格？': ['现代简约', '复古'],
    });
    expect(text).toContain('现代简约, 复古');
  });
});

describe('normalizeElicitationAnswers', () => {
  it('coerces array values to comma-separated strings', () => {
    expect(normalizeElicitationAnswers({ q1: ['a', 'b'] })).toEqual({ q1: 'a, b' });
  });
});

describe('normalizeElicitationQuestions', () => {
  it('accepts header-only question payloads from models', () => {
    const questions = normalizeElicitationQuestions([
      {
        header: '替代方案',
        options: [
          { label: '使用占位符', description: '使用占位符文件代替实际生成的图片' },
          { label: '等待重试', description: '等待图片生成服务恢复后重试' },
        ],
      },
    ]);
    expect(questions).toHaveLength(1);
    expect(questions[0]?.question).toBe('替代方案');
    expect(questions[0]?.options).toHaveLength(2);
  });

  it('formats header-only questions in answer markdown', () => {
    const questions = normalizeElicitationQuestions([
      {
        header: '替代方案',
        options: [
          { label: '使用占位符', description: '' },
          { label: '等待重试', description: '' },
        ],
      },
    ]);
    const text = formatElicitationAnswersMarkdown(questions, { 替代方案: '使用占位符' });
    expect(text).toContain('使用占位符');
  });

  it('hides unanswered ask_user_question tool rows from transcript', () => {
    const hidden = shouldHideUnansweredAskUserQuestionToolMessage({
      type: 'assistant',
      isToolUse: true,
      toolName: 'ask_user_question',
      toolInput: {
        questions: [{
          header: '替代方案',
          options: [
            { label: '使用占位符', description: '使用占位符文件代替实际生成的图片' },
            { label: '等待重试', description: '等待图片生成服务恢复后重试' },
          ],
        }],
      },
      timestamp: new Date().toISOString(),
    });
    expect(hidden).toBe(true);
  });

  it('keeps answered ask_user_question tool rows in transcript', () => {
    const visible = shouldHideUnansweredAskUserQuestionToolMessage({
      type: 'assistant',
      isToolUse: true,
      toolName: 'AskUserQuestion',
      toolInput: {
        questions: [{ question: 'Pick one', header: 'Choice', options: [{ label: 'A', description: '' }] }],
      },
      toolResult: {
        toolUseResult: {
          answers: { 'Pick one': 'A' },
        },
      },
      timestamp: new Date().toISOString(),
    });
    expect(visible).toBe(false);
    expect(hasElicitationAnswers({ 'Pick one': 'A' })).toBe(true);
  });
});

describe('extractElicitationFromToolMessage', () => {
  it('reads answers from tool result payload', () => {
    const extracted = extractElicitationFromToolMessage({
      type: 'assistant',
      isToolUse: true,
      toolName: 'ask_user_question',
      toolInput: {
        questions: [{ question: 'Q1', header: 'H1', options: [{ label: 'A', description: '' }, { label: 'B', description: '' }] }],
      },
      toolResult: {
        toolUseResult: {
          answers: { Q1: 'A' },
        },
      },
      timestamp: new Date().toISOString(),
    });
    expect(extracted?.answers).toEqual({ Q1: 'A' });
  });
});
