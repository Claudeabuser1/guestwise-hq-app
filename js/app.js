// Guestwise HQ: screens, routing and actions. All text from the database goes through esc().
import { createStore } from './store.js';
import { areaProgress, count, openByPriority, phaseProgress, subtasksOf, topLevel } from './progress.js';

const app = document.getElementById('app');
let store, me, data, query = '', startIdx = 0, editing = false, confirmDelete = null, busy = false;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const first = (name) => String(name || '').split(/[\s@]/)[0];
const dateFmt = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
const shortFmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long' });

const I = {
  home: '<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  plan: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
const BRAND = '<img src="img/gw-g.svg" alt="" width="17" height="23">uestwise';

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600);
}

// ---------- routing ----------
function route() {
  const [path, qs] = location.hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || 'oversikt', id: parts[1], params: new URLSearchParams(qs || '') };
}
const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

// ---------- data helpers ----------
const shared = () => data.tasks.filter((t) => !t.owner);
const mine = () => data.tasks.filter((t) => t.owner === me.id);
const sharedAreas = () => data.areas.filter((a) => !a.owner).sort((a, b) => a.position - b.position);
const myAreas = () => data.areas.filter((a) => a.owner === me.id).sort((a, b) => a.created_at?.localeCompare?.(b.created_at) || 0);
const areaName = (id) => data.areas.find((a) => a.id === id)?.name ?? 'Utan område';
const phaseName = (p) => (p === 'launch' ? 'Lansering' : 'Tillväxt');

async function refresh() { data = await store.load(); render(); }
async function act(fn, ok) {
  if (busy) return; busy = true;
  try { await fn(); if (ok) toast(ok); await refresh(); }
  catch (e) { toast(e.message || 'Något gick fel. Försök igen.'); }
  finally { busy = false; }
}

// ---------- shell ----------
function shell(name, body) {
  const open = openByPriority(shared()).length;
  const link = (r, href, label, ic, extra = '') => `<a href="${href}" ${name === r ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span>${extra}</a>`;
  const nav = [
    link('oversikt', '#/', 'Översikt', 'home'),
    link('uppgifter', '#/uppgifter', 'Uppgifter', 'list', `<span class="count num">${open}</span>`),
    link('mitt', '#/mitt', 'Mitt', 'me'),
    link('planeraren', '#/planeraren', 'Planeraren', 'plan'),
  ];
  const tabs = nav.map((n) => n.replace(/<span class="count[^<]*<\/span>/, ''));
  const other = data.members.find((m) => m.email !== me.email);
  return `<a class="skip" href="#main">Hoppa till innehållet</a><div class="shell">
    <aside class="side">
      <a class="brand" href="#/" aria-label="Guestwise HQ" translate="no">${BRAND}<small>HQ</small></a>
      <nav class="nav" aria-label="Huvudmeny">${nav.join('')}</nav>
      <div class="side-foot">${other ? `<span>Delas med ${esc(first(other.name))}</span>` : ''}<span>${store.demo ? 'Demoläge' : 'Synkas mellan er'}</span></div>
    </aside>
    <div class="main">
      <header class="top">
        <form class="search" role="search" data-form="search"><label class="vh" for="q">Sök uppgifter</label>${icon('search')}<input id="q" name="q" type="search" placeholder="Sök bland uppgifterna…" value="${esc(query)}" autocomplete="off"></form>
        <div class="who"><span class="avatar" aria-hidden="true">${esc(first(me.name).slice(0, 1).toUpperCase())}</span><span>${esc(first(me.name))}</span><button class="btn text small" data-act="signout">Logga ut</button></div>
      </header>
      <header class="mobile-top"><a class="brand" href="#/" aria-label="Guestwise HQ" translate="no">${BRAND}<small>HQ</small></a><button class="btn text small" data-act="signout">Logga ut</button></header>
      <main class="canvas" id="main">${store.demo ? '<p class="demo-note">Demoläge: allt sparas bara på den här enheten tills appen kopplas till Supabase (se SETUP.md).</p>' : ''}${body}</main>
    </div>
    <nav class="tabbar" aria-label="Huvudmeny, mobil">${tabs.join('')}</nav>
  </div>`;
}

// ---------- pieces ----------
const bar = (p) => `<div class="bar" role="img" aria-label="${p.pct} procent"><i style="--p:${p.total ? p.done / p.total : 0}"></i></div>`;

function taskRow(t, opts = {}) {
  const subs = subtasksOf(data.tasks, t.id);
  const bits = [];
  if (opts.area !== false && t.area_id) bits.push(esc(areaName(t.area_id)));
  if (t.source === 'ai') bits.push('<span class="pill">AI</span>');
  if (subs.length) bits.push(`<span class="num">${subs.filter((s) => s.done).length}/${subs.length} delsteg</span>`);
  if (t.done && t.done_by) bits.push(`Klar · ${esc(first(t.done_by))}`);
  return `<li class="row${t.done ? ' done' : ''}">
    <input type="checkbox" class="check" data-toggle="${t.id}" ${t.done ? 'checked' : ''} aria-label="${t.done ? 'Ångra' : 'Klar'}: ${esc(t.title)}">
    <a class="t" href="#/uppgift/${t.id}"><b>${esc(t.title)}</b>${bits.length ? `<span class="meta">${bits.join('<span aria-hidden="true">·</span>')}</span>` : ''}</a>
    <span class="side-n num">${opts.rank ? opts.rank + '.' : ''}</span>
  </li>`;
}

function startCard(list) {
  if (!list.length) return `<section class="start s4" aria-labelledby="start-h"><span class="lbl" id="start-h">Börja här</span><p class="step">Allt i fokusfasen är klart. Byt fokus under Planeraren.</p></section>`;
  const t = list[startIdx % Math.min(list.length, 5)];
  const step = t.quick_start || t.steps?.[0] || t.title;
  return `<section class="start s4" aria-labelledby="start-h">
    <span class="lbl" id="start-h">Börja här, några minuter</span>
    <p class="step">${esc(step)}</p>
    <p class="for">Första steget i <a href="#/uppgift/${t.id}">${esc(t.title)}</a></p>
    <div class="acts"><a class="btn primary small" href="#/uppgift/${t.id}">Öppna uppgiften</a>${list.length > 1 ? '<button class="btn small" data-act="next-start">Visa ett annat</button>' : ''}</div>
  </section>`;
}

// ---------- screens ----------
function home() {
  const focus = data.settings.focus_phase;
  const areas = sharedAreas();
  const main = phaseProgress(data.tasks.filter((t) => !t.owner), areas, focus);
  const focusIds = new Set(areas.filter((a) => a.phase === focus).map((a) => a.id));
  const open = openByPriority(shared());
  const openFocus = open.filter((t) => focusIds.has(t.area_id));
  const next = openFocus[0] ?? open[0];
  const h = new Date().getHours();
  const hello = h < 10 ? 'God morgon' : h < 17 ? 'Hej' : 'God kväll';
  const run = data.runs[0];
  const lastDone = topLevel(shared()).filter((t) => t.done && t.done_at).sort((a, b) => b.done_at.localeCompare(a.done_at))[0];

  const areaRows = (phase) => areas.filter((a) => a.phase === phase).map((a) => {
    const p = areaProgress(shared(), a.id);
    return `<a class="area" href="#/uppgifter?omrade=${encodeURIComponent(a.id)}"><span class="name">${esc(a.name)}</span><span class="n num">${p.done} av ${p.total}</span>${bar(p)}</a>`;
  }).join('');
  const otherPhase = focus === 'launch' ? 'growth' : 'launch';
  const other = phaseProgress(data.tasks.filter((t) => !t.owner), areas, otherPhase);

  return shell('oversikt', `
    <div class="title-row"><div><h1>${hello}, ${esc(first(me.name))}</h1><p class="sub">${esc(dateFmt.format(new Date()))}</p></div>
      <a class="btn primary" href="#/ny">Ny uppgift</a></div>
    <div class="grid">
      <section class="panel mainbar s8" aria-labelledby="main-h">
        <div class="panel-head"><h2 id="main-h">${phaseName(focus)}${focus === 'launch' ? ' · våren 2027' : ''}</h2><a href="#/uppgifter">Alla uppgifter</a></div>
        <div class="big"><span class="pct num">${main.pct} %</span><span class="of num">${main.done} av ${main.total} uppgifter klara</span></div>
        ${bar(main)}
        <p class="finding">${next ? `Viktigast nu: <b>${esc(next.title)}</b>` : 'Inga öppna uppgifter.'}</p>
        ${lastDone ? `<p class="last"><span>Senast klart:</span><a href="#/uppgift/${lastDone.id}">${esc(lastDone.title)}</a><span>${lastDone.done_by ? '· ' + esc(first(lastDone.done_by)) : ''} · ${esc(dayFmt.format(new Date(lastDone.done_at)))}</span></p>` : ''}
      </section>
      ${startCard(openFocus.length ? openFocus : open)}
      <section class="panel s6" aria-labelledby="areas-h">
        <div class="panel-head"><h2 id="areas-h">Delar av bolaget</h2></div>
        <div class="areas">
          <p class="group-label">${phaseName(focus)}</p>${areaRows(focus)}
          <p class="group-label">${otherPhase === 'growth' ? 'Efter lansering' : 'Lansering'} · <span class="num">${other.done} av ${other.total}</span></p>${areaRows(otherPhase)}
        </div>
      </section>
      <section class="panel s6" aria-labelledby="next-h">
        <div class="panel-head"><h2 id="next-h">Näst på tur</h2><a href="#/uppgifter">Visa alla ${open.length}</a></div>
        ${open.length ? `<ul class="rows">${open.slice(0, 5).map((t) => taskRow(t)).join('')}</ul>` : '<p class="empty">Inget öppet. Lägg till en uppgift eller låt planeraren föreslå.</p>'}
      </section>
      <section class="panel s12" aria-labelledby="plan-h">
        <div class="panel-head"><h2 id="plan-h">Planeraren</h2><a href="#/planeraren">Logg och inställningar</a></div>
        ${run ? `<div class="note"><span class="avatar" aria-hidden="true" style="background:var(--accent-soft);color:#ffb99f">AI</span><p>${esc(run.ok ? run.summary : `Körningen misslyckades: ${run.error}`)}</p><span class="when">${esc(shortFmt.format(new Date(run.ran_at)))}</span></div>`
          : '<p class="empty">Planeraren har inte kört än. Den kör 07:00 och 13:00, eller tryck Planera nu.</p>'}
      </section>
    </div>`);
}

function tasks(params) {
  const area = params.get('omrade') || '';
  const showDone = params.get('visa') === 'klara';
  const all = topLevel(shared());
  const q = query.trim().toLowerCase();
  let list = all.filter((t) => t.done === showDone && (!area || t.area_id === area) && (!q || (t.title + ' ' + t.why + ' ' + t.quick_start).toLowerCase().includes(q)));
  list = showDone ? list.sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')) : list.sort((a, b) => a.priority - b.priority);
  const c = count(all);
  const href = (o) => { const p = new URLSearchParams(); if (o.area ?? area) p.set('omrade', o.area ?? area); if (o.done ?? showDone) p.set('visa', 'klara'); const s = p.toString(); return '#/uppgifter' + (s ? '?' + s : ''); };
  const chip = (label, a) => `<a class="chip" role="button" aria-pressed="${area === a}" href="${href({ area: a })}" style="display:inline-flex;align-items:center;text-decoration:none">${esc(label)}</a>`;
  return shell('uppgifter', `
    <div class="title-row"><div><h1>Uppgifter</h1><p class="sub num">${c.total - c.done} öppna · ${c.done} klara${q ? ` · sökning: ”${esc(query)}”` : ''}</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn${showDone ? '' : ' primary'}" href="${href({ done: false })}">Öppna</a><a class="btn${showDone ? ' primary' : ''}" href="${href({ done: true })}">Klara</a><a class="btn" href="#/ny${area ? '?omrade=' + encodeURIComponent(area) : ''}">Ny uppgift</a></div></div>
    <div class="chips" style="margin-bottom:16px">${chip('Alla', '')}${sharedAreas().map((a) => chip(a.name, a.id)).join('')}</div>
    <section class="panel" aria-label="${showDone ? 'Klara uppgifter' : 'Öppna uppgifter, viktigast först'}">
      ${list.length ? `<ul class="rows">${list.map((t, i) => taskRow(t, { area: !area, rank: showDone || q ? 0 : i + 1 })).join('')}</ul>`
        : `<p class="empty">${q ? 'Inga uppgifter matchar sökningen.' : showDone ? 'Inget klart här än. Börja med det översta i Öppna.' : 'Inget öppet här. Bra jobbat.'}</p>`}
    </section>`);
}

function detail(id) {
  const t = data.tasks.find((x) => x.id === id);
  if (!t) return shell('uppgifter', '<a class="back" href="#/uppgifter">' + icon('back') + 'Uppgifter</a><p class="empty">Uppgiften finns inte längre.</p>');
  const subs = subtasksOf(data.tasks, t.id);
  const parent = t.parent_id ? data.tasks.find((x) => x.id === t.parent_id) : null;
  const backHref = parent ? `#/uppgift/${parent.id}` : t.owner ? '#/mitt' : '#/uppgifter';
  const areas = t.owner ? myAreas() : sharedAreas();
  const steps = Array.isArray(t.steps) ? t.steps : [];
  const nav = t.owner ? 'mitt' : 'uppgifter';

  if (editing) {
    return shell(nav, `<a class="back" href="#/uppgift/${t.id}">${icon('back')}Tillbaka</a>
      <form class="panel form" data-form="edit" data-id="${t.id}" style="max-width:720px">
        <h1>Redigera</h1>
        <div class="field"><label for="f-title">Titel</label><input class="input" id="f-title" name="title" required maxlength="200" autocomplete="off" value="${esc(t.title)}"></div>
        ${t.parent_id ? '' : `<div class="field"><label for="f-area">${t.owner ? 'Mål' : 'Område'}</label><select class="input" id="f-area" name="area_id"><option value="">Inget</option>${areas.map((a) => `<option value="${esc(a.id)}" ${a.id === t.area_id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>`}
        <div class="field"><label for="f-quick">Första lilla steget</label><input class="input" id="f-quick" name="quick_start" maxlength="300" autocomplete="off" value="${esc(t.quick_start)}"></div>
        <div class="field"><label for="f-why">Varför</label><textarea class="input" id="f-why" name="why" rows="2" maxlength="400">${esc(t.why)}</textarea></div>
        <div class="field"><label for="f-steps">Steg, ett per rad</label><textarea class="input" id="f-steps" name="steps" rows="6">${esc(steps.join('\n'))}</textarea></div>
        <div class="acts"><button class="btn primary" type="submit">Spara</button><button class="btn" type="button" data-act="cancel-edit">Avbryt</button></div>
      </form>`);
  }

  const facts = [
    [t.owner ? 'Mål' : 'Område', esc(areaName(t.area_id))],
    ['Skapad av', t.source === 'ai' ? 'Planeraren (AI)' : esc(first(t.created_by) || '–')],
    ['Skapad', esc(dayFmt.format(new Date(t.created_at)))],
    ['Status', t.done ? `Klar${t.done_by ? ' · ' + esc(first(t.done_by)) : ''}${t.done_at ? ' · ' + esc(dayFmt.format(new Date(t.done_at))) : ''}` : 'Öppen'],
  ];
  return shell(nav, `
    <a class="back" href="${backHref}">${icon('back')}${parent ? esc(parent.title) : t.owner ? 'Mitt' : 'Uppgifter'}</a>
    <div class="detail">
      <div class="stack">
        <div><h1>${esc(t.title)}</h1>${t.why ? `<p class="why">${esc(t.why)}</p>` : ''}</div>
        ${t.done ? '' : `<section class="start" aria-labelledby="q-h"><span class="lbl" id="q-h">Börja här, några minuter</span><p class="step">${esc(t.quick_start || steps[0] || 'Skriv ett första litet steg under Redigera.')}</p>
          <div class="acts"><button class="btn primary small" data-toggle-btn="${t.id}">Markera som klar</button></div></section>`}
        ${steps.length ? `<section class="panel" aria-labelledby="s-h"><div class="panel-head"><h2 id="s-h">Steg för steg</h2></div><ol class="steps">${steps.map((s) => `<li><span>${esc(s)}</span></li>`).join('')}</ol></section>` : ''}
        ${t.parent_id ? '' : `<section class="panel" aria-labelledby="sub-h"><div class="panel-head"><h2 id="sub-h">Delsteg</h2>${subs.length ? `<span class="meta num">${subs.filter((s) => s.done).length} av ${subs.length} klara</span>` : ''}</div>
          ${subs.length ? `<ul class="rows">${subs.map((s) => taskRow(s, { area: false })).join('')}</ul>` : '<p class="meta">Inga delsteg. Lägg till ett om uppgiften har flera delar.</p>'}
          <form class="inline-add" data-form="sub" data-id="${t.id}"><label class="vh" for="sub-new">Nytt delsteg</label><input class="input" id="sub-new" name="title" placeholder="Nytt delsteg…" maxlength="200" autocomplete="off" required><button class="btn small" type="submit">Lägg till</button></form>
        </section>`}
      </div>
      <aside class="stack">
        <section class="panel"><dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn${t.done ? '' : ' primary'}" data-toggle-btn="${t.id}">${t.done ? 'Ångra klar' : 'Klar'}</button>
          <button class="btn" data-act="edit">Redigera</button>
          ${confirmDelete === t.id ? `<button class="btn danger" data-act="delete" data-id="${t.id}">Ja, ta bort</button><button class="btn text" data-act="cancel-delete">Avbryt</button>` : `<button class="btn text" data-act="ask-delete" data-id="${t.id}">Ta bort</button>`}
        </div>
        ${t.source === 'ai' ? '<p class="meta">Skriven av planeraren. Den kan förbättra texten tills uppgiften är klar, men tar aldrig bort den.</p>' : ''}
      </aside>
    </div>`);
}

function newTask(params) {
  const mineMode = params.get('mitt') === '1';
  const areas = mineMode ? myAreas() : sharedAreas();
  const pre = params.get('omrade') || '';
  return shell(mineMode ? 'mitt' : 'uppgifter', `
    <a class="back" href="${mineMode ? '#/mitt' : '#/uppgifter'}">${icon('back')}${mineMode ? 'Mitt' : 'Uppgifter'}</a>
    <form class="panel form" data-form="new" data-mine="${mineMode ? 1 : 0}" style="max-width:720px">
      <h1>${mineMode ? 'Ny egen uppgift' : 'Ny uppgift'}</h1>
      <p class="meta">${mineMode ? 'Bara du ser den.' : 'Ni ser den båda. Planeraren kan flytta den i ordningen men ändrar aldrig texten.'}</p>
      <div class="field"><label for="n-title">Vad ska göras?</label><input class="input" id="n-title" name="title" required maxlength="200" placeholder="Till exempel: Skicka offert till Café Linnéa…" autocomplete="off"></div>
      <div class="two">
        <div class="field"><label for="n-area">${mineMode ? 'Mål' : 'Område'}</label><select class="input" id="n-area" name="area_id"><option value="">Inget</option>${areas.map((a) => `<option value="${esc(a.id)}" ${a.id === pre ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="n-pos">Placering</label><select class="input" id="n-pos" name="pos"><option value="last">Sist i listan</option><option value="first">Först, det här är viktigast</option></select></div>
      </div>
      <div class="field"><label for="n-quick">Första lilla steget</label><input class="input" id="n-quick" name="quick_start" maxlength="300" placeholder="Något som tar under fem minuter…" autocomplete="off"></div>
      <div class="field"><label for="n-steps">Steg, ett per rad</label><textarea class="input" id="n-steps" name="steps" rows="4"></textarea></div>
      <div class="acts"><button class="btn primary" type="submit">Lägg till</button><a class="btn" href="${mineMode ? '#/mitt' : '#/uppgifter'}">Avbryt</a></div>
    </form>`);
}

function personal() {
  const goals = myAreas();
  const tasksOf = (id) => topLevel(mine()).filter((t) => (id ? t.area_id === id : !t.area_id)).sort((a, b) => a.done - b.done || a.priority - b.priority);
  const loose = tasksOf(null);
  const goalPanel = (g) => {
    const list = tasksOf(g.id), p = count(list);
    return `<section class="panel s6" aria-labelledby="g-${g.id}">
      <div class="panel-head"><h2 id="g-${g.id}">${esc(g.name)}</h2><span class="meta num">${p.done} av ${p.total} · ${p.pct} %</span></div>
      ${bar(p)}
      <ul class="rows" style="margin-top:12px">${list.map((t) => taskRow(t, { area: false })).join('')}</ul>
      <form class="inline-add" data-form="mine-task" data-area="${esc(g.id)}"><label class="vh" for="m-${g.id}">Ny uppgift i ${esc(g.name)}</label><input class="input" id="m-${g.id}" name="title" placeholder="Ny uppgift…" maxlength="200" autocomplete="off" required><button class="btn small" type="submit">Lägg till</button></form>
      ${list.length ? '' : `<button class="btn text small" style="margin-top:8px" data-act="delete-goal" data-id="${esc(g.id)}">Ta bort målet</button>`}
    </section>`;
  };
  const goalForm = `<section class="panel s6" aria-labelledby="goal-h">
        <div class="panel-head"><h2 id="goal-h">Nytt mål</h2></div>
        <p class="meta">Ett mål får en egen stapel. Till exempel ”Lär mig sälja” eller ”Bli klar med Instagram-kontot”.</p>
        <form class="inline-add" data-form="goal"><label class="vh" for="goal-new">Namn på målet</label><input class="input" id="goal-new" name="name" maxlength="60" placeholder="Namn på målet…" autocomplete="off" required><button class="btn small" type="submit">Skapa</button></form>
      </section>`;
  return shell('mitt', `
    <div class="title-row"><div><h1>Mitt</h1><p class="sub">Dina egna mål och uppgifter. Bara du ser dem, ${esc(first(data.members.find((m) => m.email !== me.email)?.name) || 'din kollega')} kan inte.</p></div></div>
    <div class="grid top-aligned">
      ${goals.length ? '' : goalForm}
      ${goals.map(goalPanel).join('')}
      <section class="panel s6" aria-labelledby="loose-h">
        <div class="panel-head"><h2 id="loose-h">Utan mål</h2><span class="meta num">${count(loose).done} av ${loose.length}</span></div>
        ${loose.length ? `<ul class="rows">${loose.map((t) => taskRow(t, { area: false })).join('')}</ul>` : '<p class="meta">Snabba saker som inte hör till ett mål.</p>'}
        <form class="inline-add" data-form="mine-task" data-area=""><label class="vh" for="m-loose">Ny egen uppgift</label><input class="input" id="m-loose" name="title" placeholder="Ny uppgift…" maxlength="200" autocomplete="off" required><button class="btn small" type="submit">Lägg till</button></form>
      </section>
      ${goals.length ? goalForm : ''}
    </div>`);
}

function planner() {
  const s = data.settings;
  const runs = data.runs;
  return shell('planeraren', `
    <div class="title-row"><div><h1>Planeraren</h1><p class="sub">AI som går igenom planen 07:00 och 13:00. Den lägger till uppgifter och sorterar dem, men tar aldrig bort något och bockar aldrig av.</p></div>
      <button class="btn primary" data-act="plan" ${busy ? 'disabled' : ''}>Planera nu</button></div>
    <div class="grid top-aligned">
      <section class="panel s8" aria-labelledby="log-h">
        <div class="panel-head"><h2 id="log-h">Logg</h2><span class="meta num">${runs.length} körningar</span></div>
        ${runs.length ? `<ul class="rows">${runs.map((r) => `<li class="row" style="grid-template-columns:1fr auto">
          <div class="t"><b>${esc(r.ok ? r.summary : 'Körningen misslyckades')}</b>
            ${r.ok && r.changes?.added?.length ? `<span class="meta">La till: ${r.changes.added.map(esc).join(', ')}</span>` : ''}
            ${r.ok && r.changes?.reordered ? `<span class="meta num">Ändrade ordningen på ${r.changes.reordered} uppgifter</span>` : ''}
            ${r.ok ? '' : `<span class="err">${esc(r.error)}</span>`}</div>
          <span class="side-n">${esc(shortFmt.format(new Date(r.ran_at)))}${r.trigger === 'manual' ? ' · manuellt' : ''}</span></li>`).join('')}</ul>`
          : '<p class="empty">Inga körningar än.</p>'}
      </section>
      <div class="stack s4">
        <section class="panel" aria-labelledby="focus-h">
          <div class="panel-head"><h2 id="focus-h">Huvudstapeln följer</h2></div>
          <div class="chips"><button class="chip" aria-pressed="${s.focus_phase === 'launch'}" data-act="focus" data-v="launch">Lansering</button><button class="chip" aria-pressed="${s.focus_phase === 'growth'}" data-act="focus" data-v="growth">Tillväxt</button></div>
          <p class="meta" style="margin-top:10px">Byt till Tillväxt efter lanseringen, så pekar stapeln och planeraren mot intäkter och uppdateringar.</p>
        </section>
        <form class="panel form" data-form="brief" aria-labelledby="brief-h">
          <div class="panel-head" style="margin:0"><h2 id="brief-h">Det planeraren vet</h2></div>
          <p class="meta">Läget, målen och det som är viktigt för er. Uppdatera när något ändras.</p>
          <label class="vh" for="brief">Brief</label><textarea class="input" id="brief" name="brief" rows="12">${esc(s.brief)}</textarea>
          <div class="acts"><button class="btn" type="submit">Spara</button></div>
        </form>
      </div>
    </div>`);
}

function render() {
  if (!data) return;
  const r = route();
  if (r.name !== 'uppgift') { editing = false; confirmDelete = null; }
  const html = r.name === 'uppgifter' ? tasks(r.params) : r.name === 'uppgift' ? detail(r.id) : r.name === 'ny' ? newTask(r.params)
    : r.name === 'mitt' ? personal() : r.name === 'planeraren' ? planner() : home();
  app.innerHTML = html;
  const titles = { oversikt: 'Översikt', uppgifter: 'Uppgifter', uppgift: 'Uppgift', ny: 'Ny uppgift', mitt: 'Mitt', planeraren: 'Planeraren' };
  document.title = `${titles[r.name] ?? 'Översikt'} – Guestwise HQ`;
}

// ---------- gate ----------
function gate(msg) {
  app.innerHTML = `<div class="gate"><div class="panel">
    <span class="brand" translate="no">${BRAND}<small>HQ</small></span>
    <h1>${msg ? 'Inte behörig' : 'Logga in'}</h1>
    <p class="sub">${msg ? esc(msg) : 'Planen, uppgifterna och era mål för Guestwise. Bara för grundarna.'}</p>
    ${msg ? '<button class="btn" data-act="signout">Logga ut</button>' : '<button class="btn primary" data-act="signin">Fortsätt med Google</button>'}
  </div></div>`;
}

// ---------- events ----------
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);

app.addEventListener('change', (e) => {
  const id = e.target.dataset?.toggle;
  if (id) { const t = data.tasks.find((x) => x.id === id); act(() => store.updateTask(id, { done: !t.done }), t.done ? 'Öppnad igen' : 'Klar!'); }
});

app.addEventListener('click', (e) => {
  const tb = e.target.closest('[data-toggle-btn]');
  if (tb) { const id = tb.dataset.toggleBtn, t = data.tasks.find((x) => x.id === id); return act(() => store.updateTask(id, { done: !t.done }), t.done ? 'Öppnad igen' : 'Klar!'); }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act;
  if (a === 'signin') store.signIn();
  else if (a === 'signout') store.signOut().then(() => location.reload());
  else if (a === 'next-start') { startIdx++; render(); }
  else if (a === 'edit') { editing = true; render(); }
  else if (a === 'cancel-edit') { editing = false; render(); }
  else if (a === 'ask-delete') { confirmDelete = b.dataset.id; render(); }
  else if (a === 'cancel-delete') { confirmDelete = null; render(); }
  else if (a === 'delete') {
    const t = data.tasks.find((x) => x.id === b.dataset.id);
    act(async () => { await store.deleteTask(t.id); confirmDelete = null; location.hash = t.parent_id ? `#/uppgift/${t.parent_id}` : t.owner ? '#/mitt' : '#/uppgifter'; }, 'Borttagen');
  } else if (a === 'delete-goal') act(() => store.deleteArea(b.dataset.id), 'Målet togs bort');
  else if (a === 'focus') act(() => store.updateSettings({ focus_phase: b.dataset.v }), 'Sparat');
  else if (a === 'plan') {
    b.disabled = true; b.textContent = 'Planerar… upp till två minuter';
    act(async () => { const r = await store.planNow(); toast(r.summary || 'Klart'); });
  }
});

app.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(f));
  const kind = f.dataset.form;
  if (kind === 'search') { query = v.q || ''; go('#/uppgifter'); }
  else if (kind === 'new') {
    const mineMode = f.dataset.mine === '1';
    const pool = topLevel(mineMode ? mine() : shared()).filter((t) => !t.done).map((t) => t.priority);
    const priority = v.pos === 'first' ? Math.min(10, ...pool) - 10 : Math.max(0, ...pool) + 10;
    act(async () => {
      const row = await store.addTask({ title: v.title.trim(), area_id: v.area_id || null, quick_start: v.quick_start.trim(), steps: lines(v.steps), priority, owner: mineMode ? me.id : null });
      location.hash = `#/uppgift/${row.id}`;
    }, 'Tillagd');
  } else if (kind === 'edit') {
    const patch = { title: v.title.trim(), quick_start: v.quick_start.trim(), why: v.why.trim(), steps: lines(v.steps) };
    if ('area_id' in v) patch.area_id = v.area_id || null;
    act(async () => { await store.updateTask(f.dataset.id, patch); editing = false; }, 'Sparat');
  } else if (kind === 'sub') {
    const n = subtasksOf(data.tasks, f.dataset.id).length;
    act(() => store.addTask({ parent_id: f.dataset.id, title: v.title.trim(), priority: n + 1 }), 'Delsteg tillagt');
  } else if (kind === 'mine-task') {
    act(() => store.addTask({ title: v.title.trim(), owner: me.id, area_id: f.dataset.area || null, priority: Date.now() % 1e9 }), 'Tillagd');
  } else if (kind === 'goal') act(() => store.addArea({ name: v.name.trim(), owner: me.id, phase: 'launch' }), 'Målet skapat');
  else if (kind === 'brief') act(() => store.updateSettings({ brief: v.brief }), 'Sparat');
});

// ---------- start ----------
async function boot() {
  try {
    store = await createStore();
    me = await store.session();
    if (!me) return gate();
    if (!(await store.isMember())) return gate(`Kontot ${me.email} har inte åtkomst. Be den som satte upp appen lägga till e-postadressen.`);
    await refresh();
    window.addEventListener('hashchange', render);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh().catch(() => {}); });
  } catch (e) {
    app.innerHTML = `<div class="gate"><div class="panel"><h1>Kunde inte ladda</h1><p class="sub">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Försök igen</button></div></div>`;
  }
}
boot();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
