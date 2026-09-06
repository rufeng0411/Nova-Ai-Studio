const html = await (await fetch('https://www.novapage.online/')).text();
const m = html.match(/assets\/index-[^"]+\.js/);
const js = await (await fetch(`https://www.novapage.online/${m[0]}`)).text();
console.log('bundle', m[0]);
console.log('TAIL true', /VITE_TAIL_MESSAGE_PAGINATION.{0,30}true/.test(js));
console.log('TAIL false', /VITE_TAIL_MESSAGE_PAGINATION.{0,30}false/.test(js));
