import { describe, expect, it, beforeEach } from 'vitest';
import {
  _clearTaskResumeCoordinatorForTests,
  buildTaskResumeMessage,
  markTaskResumeFired,
  prepareUserManualTaskResume,
  taskResumePriority,
  tryTaskResumeSchedule,
} from './taskResumeCoordinator';

describe('taskResumeCoordinator', () => {
  beforeEach(() => {
    _clearTaskResumeCoordinatorForTests();
  });

  it('allows only one resume per boundary', () => {
    expect(tryTaskResumeSchedule('turn-1', 'infra_interrupt')).toBe(true);
    expect(tryTaskResumeSchedule('turn-1', 'deliverable_repair')).toBe(false);
  });

  it('lets higher priority replace pending lower priority before firing', () => {
    expect(tryTaskResumeSchedule('turn-2', 'recovery_pause')).toBe(true);
    expect(tryTaskResumeSchedule('turn-2', 'infra_interrupt')).toBe(true);
    markTaskResumeFired('turn-2', 'infra_interrupt');
    expect(tryTaskResumeSchedule('turn-2', 'deliverable_repair')).toBe(false);
  });

  it('allows higher priority owner to replace a pending lower priority schedule', () => {
    expect(tryTaskResumeSchedule('turn-3', 'recovery_pause')).toBe(true);
    expect(tryTaskResumeSchedule('turn-3', 'deliverable_repair')).toBe(true);
    expect(tryTaskResumeSchedule('turn-3', 'stale_turn')).toBe(false);
  });

  it('keeps stale_turn below recovery_pause but below infra owner', () => {
    expect(tryTaskResumeSchedule('turn-4', 'recovery_pause')).toBe(true);
    expect(tryTaskResumeSchedule('turn-4', 'stale_turn')).toBe(false);
    expect(tryTaskResumeSchedule('turn-4', 'infra_interrupt')).toBe(true);
    expect(taskResumePriority('recovery_pause')).toBeGreaterThan(taskResumePriority('stale_turn'));
  });

  it('ranks cold_resume above stale_turn but below live recovery owners', () => {
    // cold_resume preempts a pending stale_turn (server-verified is more authoritative)
    expect(tryTaskResumeSchedule('turn-5', 'stale_turn')).toBe(true);
    expect(tryTaskResumeSchedule('turn-5', 'cold_resume')).toBe(true);
    // but a live recovery owner still preempts cold_resume
    expect(tryTaskResumeSchedule('turn-5', 'recovery_pause')).toBe(true);
    expect(taskResumePriority('cold_resume')).toBeGreaterThan(taskResumePriority('stale_turn'));
    expect(taskResumePriority('cold_resume')).toBeLessThan(taskResumePriority('recovery_pause'));
    expect(taskResumePriority('cold_resume')).toBeLessThan(taskResumePriority('infra_interrupt'));
  });

  it('does not let cold_resume preempt an already-fired owner', () => {
    expect(tryTaskResumeSchedule('turn-6', 'recovery_pause')).toBe(true);
    markTaskResumeFired('turn-6', 'recovery_pause');
    expect(tryTaskResumeSchedule('turn-6', 'cold_resume')).toBe(false);
  });

  it('prepareUserManualTaskResume resets dedupe so user can retry after a blocked send', () => {
    expect(tryTaskResumeSchedule('turn-7', 'recovery_pause')).toBe(true);
    markTaskResumeFired('turn-7', 'recovery_pause');
    expect(tryTaskResumeSchedule('turn-7', 'ui_incomplete_deliverable')).toBe(false);
    expect(prepareUserManualTaskResume('turn-7', 'ui_incomplete_deliverable')).toBe(true);
    expect(markTaskResumeFired('turn-7', 'ui_incomplete_deliverable')).toBe(true);
  });

  it('builds structured task-resume xml', () => {
    const xml = buildTaskResumeMessage({
      context: 'infra_interrupt',
      userGoal: '写报告',
      instruction: '继续',
    });
    expect(xml).toContain('<task-resume context="infra_interrupt">');
    expect(xml).toContain('<user_goal>写报告</user_goal>');
  });
});
