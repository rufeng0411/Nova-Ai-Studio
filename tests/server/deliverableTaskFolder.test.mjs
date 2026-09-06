/**
 * PD-SAAS-FORK: deliverableTaskFolder snapshot v2 real-filesystem integration tests
 */
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  buildTaskFolderSnapshot,
  handleTaskFolderSnapshot,
  parseTaskFolderSnapshotSlots,
} from '../../ui/server/routes/deliverableTaskFolder.js';

async function withTempProject(run) {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pilotdeck-task-folder-'));
  try {
    return await run(projectDir);
  } finally {
    await fs.rm(projectDir, { recursive: true, force: true });
  }
}

async function writeProjectFile(projectDir, relativePath, content = 'fixture') {
  const absPath = path.join(projectDir, ...relativePath.split('/'));
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content);
}

async function writeNumberedFiles(projectDir, directory, prefix, count, extension) {
  await Promise.all(Array.from({ length: count }, (_, index) => {
    const fileName = `${prefix}-${String(index + 1).padStart(4, '0')}.${extension}`;
    return writeProjectFile(projectDir, `${directory}/${fileName}`);
  }));
}

function activeSlot(input) {
  return {
    required: true,
    status: 'active',
    ...input,
  };
}

async function invokeSnapshotHandler(input) {
  const result = {
    statusCode: 200,
    body: undefined,
  };
  const response = {
    status(statusCode) {
      result.statusCode = statusCode;
      return response;
    },
    json(body) {
      result.body = body;
      return body;
    },
  };
  await handleTaskFolderSnapshot(
    {
      params: { projectName: 'general' },
      query: input.query,
    },
    response,
    input.dependencies,
  );
  return result;
}

test('node_modules is excluded without consuming the 500-file evidence budget', async () => {
  await withTempProject(async (projectDir) => {
    const scopeDir = 'artifacts/task-node-modules';
    await writeNumberedFiles(projectDir, `${scopeDir}/node_modules`, 'ignored', 520, 'md');
    await writeProjectFile(projectDir, `${scopeDir}/report.md`);

    const snapshot = await buildTaskFolderSnapshot({
      projectDir,
      scopeDir,
      slots: [activeSlot({
        id: 'report',
        label: '报告',
        kind: 'markdown',
        pathHint: 'report.md',
      })],
    });

    assert.equal(snapshot.snapshotComplete, true);
    assert.equal(snapshot.truncated, false);
    assert.equal(snapshot.files.length, 1);
    assert.equal(snapshot.files[0].path, `${scopeDir}/report.md`);
    assert.equal(snapshot.files[0].inContract, true);
    assert.ok(snapshot.excludedCount >= 1);
  });
});

test('snapshot keeps priority hints first and caps total evidence at 500', async () => {
  await withTempProject(async (projectDir) => {
    const scopeDir = 'artifacts/task-overflow';
    await writeNumberedFiles(projectDir, scopeDir, 'extra', 510, 'md');
    await writeProjectFile(projectDir, `${scopeDir}/zz-priority.md`);

    const snapshot = await buildTaskFolderSnapshot({
      projectDir,
      scopeDir,
      slots: [activeSlot({
        id: 'priority',
        label: '优先报告',
        kind: 'markdown',
        pathHint: 'zz-priority.md',
      })],
    });

    assert.equal(snapshot.files.length, 500);
    assert.equal(snapshot.files[0].path, `${scopeDir}/zz-priority.md`);
    assert.equal(snapshot.files.some((file) => file.path.endsWith('/zz-priority.md')), true);
    assert.equal(snapshot.binding.matchedCount, 1);
    assert.equal(snapshot.truncated, true);
    assert.equal(snapshot.snapshotComplete, false);
    assert.equal(snapshot.truncationReason, 'file_budget_exceeded');
  });
});

test('real filesystem snapshot binds all 10 slide pages one-to-one', async () => {
  await withTempProject(async (projectDir) => {
    const scopeDir = 'artifacts/task-slides';
    await Promise.all(Array.from({ length: 10 }, (_, index) => {
      const page = String(index + 1).padStart(2, '0');
      return writeProjectFile(projectDir, `${scopeDir}/slide-${page}.png`);
    }));

    const snapshot = await buildTaskFolderSnapshot({
      projectDir,
      scopeDir,
      slots: [activeSlot({
      id: 'slides',
      label: '10页幻灯',
      kind: 'image',
      count: 10,
      })],
    });

    assert.equal(snapshot.snapshotComplete, true);
    assert.equal(snapshot.binding.complete, true);
    assert.equal(snapshot.binding.requiredCount, 10);
    assert.equal(snapshot.binding.matchedCount, 10);
    assert.equal(snapshot.files.filter((file) => file.inContract).length, 10);
    assert.equal(new Set(snapshot.files.map((file) => file.unitId)).size, 10);
    assert.equal(snapshot.files.every((file) => file.slotId === 'slides'), true);
  });
});

test('GEO dual markdown and dual HTML files bind to distinct slots', async () => {
  await withTempProject(async (projectDir) => {
    const scopeDir = 'artifacts/task-geo';
    await Promise.all([
      writeProjectFile(projectDir, `${scopeDir}/audit-report.md`),
      writeProjectFile(projectDir, `${scopeDir}/audit-report.html`),
      writeProjectFile(projectDir, `${scopeDir}/strategy-report.md`),
      writeProjectFile(projectDir, `${scopeDir}/strategy-report.html`),
    ]);

    const snapshot = await buildTaskFolderSnapshot({
      projectDir,
      scopeDir,
      slots: [
        activeSlot({
        id: 'audit_md',
        label: '审计 MD',
        kind: 'markdown',
        pathHint: 'audit-report.md',
        pathHints: ['audit-report.md'],
        }),
        activeSlot({
        id: 'audit_html',
        label: '审计 HTML',
        kind: 'html',
        pathHint: 'audit-report.html',
        pathHints: ['audit-report.html'],
        }),
        activeSlot({
          id: 'strategy_md',
          label: '策略 MD',
          kind: 'markdown',
          pathHint: 'strategy-report.md',
          pathHints: ['strategy-report.md'],
        }),
        activeSlot({
          id: 'strategy_html',
          label: '策略 HTML',
          kind: 'html',
          pathHint: 'strategy-report.html',
          pathHints: ['strategy-report.html'],
        }),
      ],
    });

    const contractFiles = snapshot.files.filter((file) => file.inContract);
    assert.equal(snapshot.binding.complete, true);
    assert.equal(snapshot.binding.matchedCount, 4);
    assert.equal(contractFiles.length, 4);
    assert.equal(new Set(contractFiles.map((file) => file.slotId)).size, 4);
  });
});

test('scope traversal is rejected before filesystem scanning', async () => {
  await withTempProject(async (projectDir) => {
    await assert.rejects(
      () => buildTaskFolderSnapshot({
        projectDir,
        scopeDir: 'artifacts/task-safe/../../outside',
        slots: [],
      }),
      (error) => error?.statusCode === 400 && /scopeDir/.test(error.message),
    );
  });
});

test('invalid slotsJson is rejected as a 400 input error', () => {
  assert.throws(
    () => parseTaskFolderSnapshotSlots('{"not valid"'),
    (error) => error?.statusCode === 400 && /slotsJson/.test(error.message),
  );
  assert.throws(
    () => parseTaskFolderSnapshotSlots('{"slots":[]}'),
    (error) => error?.statusCode === 400 && /array/.test(error.message),
  );
});

test('priority hints reuse excluded-directory and process-file filters', async () => {
  await withTempProject(async (projectDir) => {
    const scopeDir = 'artifacts/task-priority-filter';
    await Promise.all([
      writeProjectFile(projectDir, `${scopeDir}/report.md`),
      writeProjectFile(projectDir, `${scopeDir}/build.py`),
      writeProjectFile(projectDir, `${scopeDir}/node_modules/secret.md`),
    ]);

    const snapshot = await buildTaskFolderSnapshot({
      projectDir,
      scopeDir,
      slots: [
        activeSlot({ id: 'report', label: '报告', kind: 'markdown', pathHint: 'report.md' }),
        activeSlot({ id: 'script', label: '脚本', kind: 'markdown', pathHint: 'build.py' }),
        activeSlot({
          id: 'secret',
          label: '依赖文件',
          kind: 'markdown',
          pathHint: `${scopeDir}/node_modules/secret.md`,
        }),
      ],
    });

    assert.deepEqual(snapshot.files.map((file) => file.basename), ['report.md']);
  });
});

test('priority hints never follow a symbolic-link or junction outside scope', async () => {
  await withTempProject(async (projectDir) => {
    const scopeDir = 'artifacts/task-symlink';
    const outsideDir = path.join(projectDir, 'outside');
    const scopeAbs = path.join(projectDir, ...scopeDir.split('/'));
    const linkAbs = path.join(scopeAbs, 'linked');
    await writeProjectFile(projectDir, 'outside/report.md');
    await fs.mkdir(scopeAbs, { recursive: true });
    await fs.symlink(
      outsideDir,
      linkAbs,
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    const snapshot = await buildTaskFolderSnapshot({
      projectDir,
      scopeDir,
      slots: [activeSlot({
        id: 'report',
        label: '报告',
        kind: 'markdown',
        pathHint: `${scopeDir}/linked/report.md`,
      })],
    });

    assert.equal(snapshot.files.some((file) => file.path.includes('/linked/')), false);
  });
});

test('non-ENOENT readdir and priority stat errors make snapshots inconclusive', async () => {
  await withTempProject(async (projectDir) => {
    const scopeDir = 'artifacts/task-fs-errors';
    await writeProjectFile(projectDir, `${scopeDir}/report.md`);

    const readdirError = new Error('denied');
    readdirError.code = 'EACCES';
    const readdirFailure = await buildTaskFolderSnapshot({
      projectDir,
      scopeDir,
      slots: [],
      fileSystem: {
        ...fs,
        readdir: async () => {
          throw readdirError;
        },
      },
    });
    assert.equal(readdirFailure.snapshotComplete, false);
    assert.equal(readdirFailure.truncated, true);
    assert.equal(readdirFailure.truncationReason, 'filesystem_error');

    const statError = new Error('denied');
    statError.code = 'EACCES';
    const statFailure = await buildTaskFolderSnapshot({
      projectDir,
      scopeDir,
      slots: [activeSlot({
        id: 'report',
        label: '报告',
        kind: 'markdown',
        pathHint: 'report.md',
      })],
      fileSystem: {
        ...fs,
        lstat: async (absPath) => {
          if (String(absPath).endsWith('report.md')) throw statError;
          return fs.lstat(absPath);
        },
      },
    });
    assert.equal(statFailure.snapshotComplete, false);
    assert.equal(statFailure.truncated, true);
    assert.equal(statFailure.truncationReason, 'filesystem_error');
  });
});

test('HTTP handler wires 400 validation and complete snapshot-v2 response fields', async () => {
  await withTempProject(async (projectDir) => {
    const scopeDir = 'artifacts/task-http';
    await writeProjectFile(projectDir, `${scopeDir}/report.md`);
    let dependencyCalls = 0;
    const dependencies = {
      extractProjectDirectory: async () => {
        dependencyCalls += 1;
        return projectDir;
      },
    };

    const invalidJson = await invokeSnapshotHandler({
      query: { scopeDir, slotsJson: '{"bad"' },
      dependencies,
    });
    assert.equal(invalidJson.statusCode, 400);

    const escapedScope = await invokeSnapshotHandler({
      query: { scopeDir: 'artifacts/task-http/../../outside', slotsJson: '[]' },
      dependencies,
    });
    assert.equal(escapedScope.statusCode, 400);

    const success = await invokeSnapshotHandler({
      query: {
        scopeDir,
        slotsJson: JSON.stringify([
          activeSlot({
            id: 'report',
            label: '报告',
            kind: 'markdown',
            pathHint: 'report.md',
          }),
        ]),
      },
      dependencies,
    });
    assert.equal(success.statusCode, 200);
    assert.equal(dependencyCalls, 2);
    const httpBody = JSON.parse(JSON.stringify(success.body));
    for (const field of [
      'files',
      'snapshotVersion',
      'truncated',
      'scannedCount',
      'excludedCount',
      'snapshotComplete',
      'truncationReason',
      'binding',
    ]) {
      assert.equal(Object.hasOwn(httpBody, field), true, `missing response field: ${field}`);
    }
    assert.equal(httpBody.snapshotVersion, 2);
    assert.equal(httpBody.snapshotComplete, true);
    assert.equal(httpBody.truncated, false);
    assert.equal(typeof httpBody.scannedCount, 'number');
    assert.equal(typeof httpBody.excludedCount, 'number');
    assert.equal(httpBody.binding.matchedCount, 1);
    assert.deepEqual(
      {
        path: httpBody.files[0].path,
        slotId: httpBody.files[0].slotId,
        unitId: httpBody.files[0].unitId,
        inContract: httpBody.files[0].inContract,
      },
      {
        path: `${scopeDir}/report.md`,
        slotId: 'report',
        unitId: 'report',
        inContract: true,
      },
    );
  });
});
