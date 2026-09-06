import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Markdown } from './Markdown';

afterEach(() => {
 cleanup();
});

describe('Markdown deliverable links', () => {
 it('linkifies plain deliverable paths inside markdown tables', () => {
 const onFileOpen = vi.fn();
 render(
 <Markdown
 projectName="雷蛇项目"
  interaction={{
  onFileOpen,
  turnArtifactDir: 'artifacts/razer-blade-geo-20260623-1000',
  }}
 >
 {[
 '| 文件 | 路径 |',
 '| --- | --- |',
  '| 知乎稿 | zhihu.md |',
 '| 知乎稿 | artifacts/razer-blade-geo-20260623-1000/drafts/zhihu.md |',
 ].join('\n')}
 </Markdown>,
 );

 fireEvent.click(screen.getByRole('button', { name: 'zhihu.md' }));
 expect(onFileOpen).toHaveBeenCalledWith(
 'zhihu.md',
 expect.objectContaining({
 initialPreview: true,
 hintDir: 'artifacts/razer-blade-geo-20260623-1000',
 }),
 );

 fireEvent.click(screen.getByRole('button', {
 name: /artifacts\/razer-blade-geo-20260623-1000\/drafts\/zhihu\.md/,
 }));

 expect(onFileOpen).toHaveBeenCalledWith(
 'artifacts/razer-blade-geo-20260623-1000/drafts/zhihu.md',
 expect.objectContaining({ initialPreview: true }),
 );
 });

 it('linkifies deliverable paths in tab-separated plain text summaries', () => {
 const onFileOpen = vi.fn();
 render(
 <Markdown
 projectName="雷蛇项目"
 interaction={{
 onFileOpen,
 turnArtifactDir: 'artifacts/geo/razer-blade-20260623',
 }}
 >
 {[
 '阶段\t文件\t说明',
 '2 · 知乎稿\tzhihu.md\t深度解析',
 '2 · 小红书稿\txiaohongshu.md\t体验种草',
 '2 · 微博稿\tweibo.md\t热点短文',
 ].join('\n')}
 </Markdown>,
 );

 for (const fileName of ['zhihu.md', 'xiaohongshu.md', 'weibo.md']) {
 fireEvent.click(screen.getByRole('button', { name: fileName }));
 expect(onFileOpen).toHaveBeenCalledWith(
 fileName,
 expect.objectContaining({
 initialPreview: true,
 hintDir: 'artifacts/geo/razer-blade-20260623',
 }),
 );
 }
 });
});
