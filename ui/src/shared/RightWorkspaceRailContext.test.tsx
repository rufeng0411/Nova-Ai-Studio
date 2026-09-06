/** @vitest-environment jsdom */

import { describe, expect, it, afterEach } from 'vitest';

import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import React, { useEffect } from 'react';

import {

  RightWorkspaceRailProvider,

  useRightWorkspaceRail,

} from './RightWorkspaceRailContext';

import type { DeliverablesDockState } from './deriveDeliverablesDockState';



const mockDockState: DeliverablesDockState = {

  rows: [{

    id: 'row-1',

    path: 'artifacts/a.md',

    resolvedPath: 'artifacts/a.md',

    linkable: true,

    previewable: true,

    status: 'delivered',

    label: 'a.md',

    kind: 'file',

  }],

  progress: { done: 1, total: 1 },

  folderPath: 'artifacts',

  folderItems: [{ id: '1', path: 'artifacts/a.md', kind: 'file' }],

  turnDeliverables: [],

  showComposerChrome: true,

  isInProgress: false,

  isRepairActive: false,

  hasSessionManifest: false,

  latestMessageId: null,

};



function Probe() {

  const rail = useRightWorkspaceRail();

  useEffect(() => {

    rail?.setDockState(mockDockState);

  }, [rail]);

  if (!rail) return null;

  return (

    <div>

      <span data-testid="rail-open">{String(rail.railOpen)}</span>

      <span data-testid="rail-panel">{rail.railPanel}</span>

      <span data-testid="preview">{rail.previewFile?.name ?? ''}</span>

      <span data-testid="open-seq">{rail.deliverablesOpenSeq}</span>

      <button type="button" onClick={() => rail.openDeliverablesTab()}>open-deliverables</button>

      <button

        type="button"

        onClick={() => rail.openPreviewFile({

          name: 'report.pdf',

          path: 'artifacts/report.pdf',

          projectName: 'general',

          initialPreview: true,

        })}

      >

        open-preview

      </button>

      <button

        type="button"

        onClick={() => rail.openTaskFolder?.([{ id: '1', path: 'artifacts/a.md', kind: 'file' }])}

      >

        open-folder

      </button>

    </div>

  );

}



function EmptyDockProbe() {

  const rail = useRightWorkspaceRail();

  if (!rail) return null;

  return (

    <div>

      <span data-testid="rail-panel">{rail.railPanel}</span>

      <span data-testid="rail-open">{String(rail.railOpen)}</span>

      <button type="button" onClick={() => rail.openDeliverablesTab()}>open-deliverables-empty</button>

    </div>

  );

}



describe('RightWorkspaceRailContext', () => {

  afterEach(() => {

    cleanup();

  });



  it('openTaskFolder switches to files tab in rail without closing it', () => {

    render(

      <RightWorkspaceRailProvider selectedProject={{ name: 'general', path: '/p/general' }}>

        <Probe />

      </RightWorkspaceRailProvider>,

    );



    fireEvent.click(screen.getByText('open-deliverables'));

    expect(screen.getByTestId('rail-open').textContent).toBe('true');

    expect(screen.getByTestId('rail-panel').textContent).toBe('files');



    fireEvent.click(screen.getByText('open-folder'));

    expect(screen.getByTestId('rail-open').textContent).toBe('true');

    expect(screen.getByTestId('rail-panel').textContent).toBe('files');

  });



  it('openDeliverablesTab clears preview when rail already open', () => {

    render(

      <RightWorkspaceRailProvider selectedProject={{ name: 'general', path: '/p/general' }}>

        <Probe />

      </RightWorkspaceRailProvider>,

    );



    fireEvent.click(screen.getByText('open-preview'));

    expect(screen.getByTestId('preview').textContent).toBe('report.pdf');



    fireEvent.click(screen.getByText('open-deliverables'));

    expect(screen.getByTestId('preview').textContent).toBe('');

    expect(screen.getByTestId('rail-open').textContent).toBe('true');

    expect(screen.getByTestId('rail-panel').textContent).toBe('files');

  });



  it('openDeliverablesTab opens task folder rail (legacy alias)', () => {

    render(

      <RightWorkspaceRailProvider selectedProject={{ name: 'general', path: '/p/general' }}>

        <EmptyDockProbe />

      </RightWorkspaceRailProvider>,

    );



    fireEvent.click(screen.getByText('open-deliverables-empty'));

    expect(screen.getByTestId('rail-open').textContent).toBe('true');

    expect(screen.getByTestId('rail-panel').textContent).toBe('files');

  });

});

