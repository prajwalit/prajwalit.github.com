import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import vm from 'node:vm';
import { read } from './helpers.js';

const html = read('index.html');
// The site uses quoted attributes; parse them independently of formatting/order.
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(match => [match[1], match[2]]));
const tags = [...html.matchAll(/<([a-z][\w-]*)\b[^>]*>/gi)].map(match => ({ tag:match[1], ...attributes(match[0]) }));
const meta = key => tags.find(tag => tag.tag === 'meta' && (tag.name === key || tag.property === key))?.content;
const origin = `https://${read('CNAME').trim()}/`;

test('search identity is descriptive and canonical domain matches deployment', () => {
  assert.match(html.match(/<title>(.*?)<\/title>/s)[1], /Prajwalit.*Unravel/);
  assert.ok(meta('description').length >= 80);
  assert.equal(tags.find(tag => tag.rel === 'canonical').href, origin);
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(data['@type'], 'ProfilePage');
  assert.equal(data.url, origin);
  assert.equal(data.mainEntity.name, 'Prajwalit');
  assert.equal(data.mainEntity.worksFor.url, 'https://unravel.tech');
});
test('social preview exists and uses the canonical public URL', () => {
  assert.equal(meta('og:url'), origin);
  const preview = new URL(meta('og:image'));
  assert.equal(preview.origin, new URL(origin).origin);
  assert.ok(existsSync(new URL(`..${preview.pathname}`, import.meta.url)));
  assert.equal(meta('twitter:image'), preview.href);
  assert.equal(meta('twitter:card'), 'summary_large_image');
  assert.ok(meta('og:image:alt'));
});
test('all local links and asset references resolve; IDs are unique', () => {
  const ids = tags.filter(tag => tag.id).map(tag => tag.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(tags.filter(tag => tag.tag === 'h1').length,1);
  for (const tag of tags) {
    const ref = tag.src ?? tag.href;
    if (!ref || /^(?:[a-z]+:|\/\/)/i.test(ref)) continue;
    const url = new URL(ref, origin);
    if (url.hash) assert.ok(ids.includes(url.hash.slice(1)), ref);
    if (url.pathname !== '/') assert.ok(existsSync(new URL(`..${url.pathname}`, import.meta.url)),ref);
  }
});
test('crawler discovery agrees on the production homepage', () => {
  assert.ok(read('robots.txt').includes(`Sitemap: ${origin}sitemap.xml`));
  const locations = [...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(locations,[origin]);
});
test('the initial HTML contains every chapter and defaults to readable fallback', () => {
  assert.ok(tags.find(tag => tag.tag === 'body').class.split(' ').includes('no-webgl'));
  for (const id of ['home','building','background','perspective','hello']) {
    assert.ok(tags.some(tag => tag.tag === 'section' && tag.id === id),id);
  }
  assert.match(html,/Everest Base Camp/);
  assert.match(html,/AI agents/);
  const dialog = tags.find(tag => tag.tag === 'dialog');
  assert.ok(tags.some(tag => tag.id === dialog['aria-labelledby']));
});
function navigation(type) {
  const scripts = [...html.matchAll(/<script([^>]*)>(.*?)<\/script>/gs)];
  const script = scripts.find(match => !attributes(match[1]).type && !attributes(match[1]).src && match[2].includes("history.scrollRestoration"))[2];
  const listeners = new Map(), calls = [];
  const history = { state: null, scrollRestoration: 'auto', replaceState: (...args) => calls.push(['replace', ...args]) };
  vm.runInNewContext(script, {
    performance: { getEntriesByType: () => [{type}] }, history,
    location: {pathname:'/', search:'?ref=friend', hash:'#hello'},
    addEventListener: (name,listener) => listeners.set(name,listener),
    scrollTo: options => calls.push(['scroll',options]),
  });
  listeners.get('pageshow')?.();
  return {history,calls};
}
test('refresh removes the chapter hash and resets instantly, without restoring old position', () => {
  const {history,calls} = navigation('reload');
  assert.equal(history.scrollRestoration,'manual');
  assert.equal(calls[0][3],'/?ref=friend');
  assert.equal(calls[1][1].top,0);
  assert.equal(calls[1][1].behavior,'instant');
});
test('normal navigation and back/forward preserve deep links', () => {
  assert.equal(navigation('navigate').calls.length,0);
  assert.equal(navigation('back_forward').calls.length,0);
});
