import { describe, expect, it } from 'vitest'
import { extractTurnAcceptanceMeta } from './turnAcceptanceMeta'

type AcceptanceMessage = Parameters<typeof extractTurnAcceptanceMeta>[0]

describe('turnAcceptanceMeta P1 compatibility', () => {
  it('keeps parsing historical metadata without composite quality fields', () => {
    const parsed = extractTurnAcceptanceMeta({
      role: 'assistant',
      content: 'done',
      turnAcceptanceMeta: {
        acceptanceStatus: 'passed',
        verifiedPaths: ['artifacts/task/report.md'],
      },
    } as AcceptanceMessage)

    expect(parsed).toMatchObject({
      acceptanceStatus: 'passed',
      verifiedPaths: ['artifacts/task/report.md'],
    })
    expect(parsed).not.toHaveProperty('compositeSlotQuality')
  })

  it('passes through bounded composite quality assessments when present', () => {
    const parsed = extractTurnAcceptanceMeta({
      role: 'assistant',
      content: 'done',
      turnAcceptanceMeta: {
        acceptanceStatus: 'needs_repair',
        verifiedPaths: ['artifacts/social-matrix/index.md'],
        compositeSlotQuality: [{
          profileId: 'social_matrix',
          slotId: 'social_pack',
          complete: false,
          reason: 'composite_directory_incomplete',
          observedPaths: ['artifacts/social-matrix/index.md'],
          requiredBasenames: ['brief.md'],
          missingBasenames: ['brief.md'],
        }],
      },
    } as AcceptanceMessage)

    expect(parsed).toMatchObject({
      compositeSlotQuality: [{
        slotId: 'social_pack',
        complete: false,
        missingBasenames: ['brief.md'],
      }],
    })
  })
})
