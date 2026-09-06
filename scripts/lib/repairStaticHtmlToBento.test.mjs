import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { splitStaticSlides, repairStaticHtmlToBento, hasBentoDocBlock } from './repairStaticHtmlToBento.mjs';

const sample = `
<div class="slides-container">
<section class="slide s1"><h1>封面</h1><p>副标题</p><div class="notes" style="display:none">开场备注</div></section>
<section class="slide s2"><h2>第二页</h2><div class="notes" style="display:none">议程说明</div></section>
</div>`;

const slides = splitStaticSlides(sample);
assert.equal(slides.length, 2);
assert.equal(slides[0].isCover, true);
assert.equal(slides[0].title, '封面');
assert.equal(slides[1].title, '第二页');

const shell = readFileSync(new URL('../../ui/public/vendor/bento/Bento_Slides.bento.html', import.meta.url), 'utf8');
const repaired = repairStaticHtmlToBento(sample, shell);
assert.equal(repaired.alreadyValid, false);
assert.equal(repaired.slideCount, 2);
assert.equal(hasBentoDocBlock(repaired.html), true);

console.log('repairStaticHtmlToBento.test.mjs ok');
