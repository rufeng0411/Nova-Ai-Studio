import { describe, expect, it } from 'vitest';
import { isDesignCanvasEnabled, setDesignCanvasEnabled } from '../../../../shared/designCanvasGate';
import { supportsDesignCanvasEditContract } from '../../../../shared/designCanvasSupport';
import { inferArtifactContract } from '../../../../shared/artifactContract';

describe('image preview + design canvas access', () => {
  it('enables design canvas by default for image contracts', () => {
    setDesignCanvasEnabled(true);
    expect(isDesignCanvasEnabled()).toBe(true);
    const contract = inferArtifactContract({
      filePath: 'artifacts/demo/hero.png',
      carrierScope: 'none',
    });
    expect(supportsDesignCanvasEditContract(contract, 'hero.png')).toBe(true);
  });
});
