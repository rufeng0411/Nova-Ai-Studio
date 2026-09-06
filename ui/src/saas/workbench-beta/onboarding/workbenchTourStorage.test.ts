import { describe, expect, it, beforeEach } from 'vitest';
import {
  TOUR_LOCAL_KEY,
  clearTourLocal,
  isTourLocallyCompleted,
  markTourLocallyCompleted,
} from './workbenchTourStorage';

describe('workbenchTourStorage', () => {
  beforeEach(() => {
    clearTourLocal();
  });

  it('marks completed locally', () => {
    expect(isTourLocallyCompleted()).toBe(false);
    markTourLocallyCompleted(false);
    expect(isTourLocallyCompleted()).toBe(true);
    expect(localStorage.getItem(TOUR_LOCAL_KEY)).toBe('1');
  });

  it('clear resets anti-flash', () => {
    markTourLocallyCompleted(true);
    clearTourLocal();
    expect(isTourLocallyCompleted()).toBe(false);
  });
});
