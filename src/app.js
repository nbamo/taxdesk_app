/* ───────── TaxDesk UI ───────── */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = x => (x < 0 ? '−$' : '$') + Math.abs(Math.round(N(x))).toLocaleString('en-US');
const uid = () => 'ret_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const STATES = ['PA', 'MD', 'NJ', 'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];
const FS = { single: 'Single', mfj: 'Married filing jointly', mfs: 'Married filing separately', hoh: 'Head of household', qss: 'Qualifying surviving spouse' };
const ENT = { scorp: 'S corporation (1120-S)', partnership: 'Partnership / multi-member LLC (1065)', ccorp: 'C corporation (1120)' };

const state = { returns: {}, view: 'home', cur: null, tab: 'profile', settings: { keepSSN: false }, store: 'memory', docs: {} };
let caps = { db: null, sample: null, downloads: null, uid: null, images: null };

/* ───── storage ───── */
function maskSSNs(o) { if (Array.isArray(o)) return o.map(maskSSNs); if (o && typeof o === 'object') { const r = {}; for (const k in o) r[k] = (k === 'ssn' && o[k] && !state.settings.keepSSN && !String(o[k]).includes('*')) ? '***-**-' + String(o[k]).replace(/\D/g, '').slice(-4) : maskSSNs(o[k]); return r; } return o; }
const writing = {}; const pending = {};
function save(ret) { ret.updated = Date.now(); clearTimeout(pending[ret.id]); pending[ret.id] = setTimeout(() => persist(ret), 700); }
async function persist(ret) {
  const body = maskSSNs(JSON.parse(JSON.stringify(ret)));
  if (state.store === 'db') {
    const prev = writing[ret.id] || Promise.resolve();
    writing[ret.id] = prev.then(() => caps.db.collection('data/users/' + caps.uid).doc(ret.id).set({ ret: body })).catch(e => toast('Save failed: ' + (e.message || e.code)));
  } else if (state.store === 'local') { try { const all = JSON.parse(localStorage.getItem('taxdesk') || '{}'); all[ret.id] = body; localStorage.setItem('taxdesk', JSON.stringify(all)); } catch (e) { } }
}
async function removeRet(id) {
  delete state.returns[id];
  if (state.store === 'db') await caps.db.collection('data/users/' + caps.uid).doc(id).delete().catch(() => { });
  else if (state.store === 'local') { try { const all = JSON.parse(localStorage.getItem('taxdesk') || '{}'); delete all[id]; localStorage.setItem('taxdesk', JSON.stringify(all)); } catch (e) { } }
}
async function saveSettings() { if (state.store === 'db') caps.db.collection('data/users/' + caps.uid).doc('settings').set(state.settings).catch(() => { }); else try { localStorage.setItem('taxdesk_settings', JSON.stringify(state.settings)); } catch (e) { } }
async function initStore() {
  try {
    const db = await window.claude?.use?.('db'); const user = await window.claude?.use?.('user');
    const id = user ? await user.id() : null;
    if (db && id) {
      caps.db = db; caps.uid = id;
      const timer = setTimeout(() => toast('Your saved returns are taking a while to load…'), 10000);
      const snap = await db.collection('data/users/' + id).get(); clearTimeout(timer);
      snap.docs.forEach(s => { const b = s.data(); if (s.id === 'settings') Object.assign(state.settings, b); else if (b && b.ret) state.returns[s.id] = b.ret; });
      state.store = 'db'; render(); return;
    }
  } catch (e) { console.warn(e); }
  try { const all = JSON.parse(localStorage.getItem('taxdesk') || '{}'); Object.assign(state.returns, all); Object.assign(state.settings, JSON.parse(localStorage.getItem('taxdesk_settings') || '{}')); state.store = 'local'; } catch (e) { state.store = 'memory'; }
  render();
}
async function initCaps() {
  try { caps.sample = await window.claude?.use?.('sample'); if (caps.sample) { const l = await caps.sample.limits().catch(() => null); caps.images = l?.images || null; } } catch (e) { }
  try { caps.downloads = await window.claude?.use?.('downloads'); } catch (e) { }
  render();
}

/* ───── helpers ───── */
function get(o, path) { return path.split('.').reduce((a, k) => a == null ? a : a[k], o); }
function set(o, path, v) { const ks = path.split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null) a[k] = /^\d+$/.test(k) ? [] : {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
function cur() { return state.returns[state.cur]; }
function compute(ret) {
  if (ret.kind === 'business') { const B = bizCalc(ret); return { B, issues: validate(ret, B, null) }; }
  const F = fed(ret), S = stateCalc(ret, F); return { F, S, issues: validate(ret, F, S) };
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 3500); }
function go(view, id, tab) { state.view = view; if (id) state.cur = id; if (tab) state.tab = tab; render(); window.scrollTo(0, 0); }

/* field builders */
function fld(path, label, o = {}) {
  const r = cur(); const v = get(r.data, path);
  const type = o.type || 'money';
  let input;
  if (type === 'select') input = `<select data-p="${path}">${Object.entries(o.opts).map(([k, l]) => `<option value="${esc(k)}" ${String(v) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  else if (type === 'check') return `<label class="chk"><input type="checkbox" data-p="${path}" ${v ? 'checked' : ''}> <span>${label}</span></label>`;
  else if (type === 'date') input = `<input type="date" data-p="${path}" value="${esc(v)}">`;
  else if (type === 'text') input = `<input type="text" data-p="${path}" value="${esc(v)}" placeholder="${esc(o.ph || '')}" ${o.max ? `maxlength="${o.max}"` : ''}>`;
  else input = `<div class="money"><span>${type === 'pct' ? '%' : '$'}</span><input type="text" inputmode="decimal" data-p="${path}" data-num="1" value="${esc(v)}" placeholder="0"></div>`;
  return `<label class="f ${o.wide ? 'wide' : ''}"><span class="lbl">${label}${o.hint ? `<i title="${esc(o.hint)}">?</i>` : ''}</span>${input}${o.help ? `<small>${o.help}</small>` : ''}</label>`;
}
function group(title, arrPath, itemFn, blank, addLabel) {
  const arr = get(cur().data, arrPath) || [];
  return `<div class="grp"><div class="grp-h"><h3>${title}</h3><button class="btn sm" data-add="${arrPath}" data-blank='${esc(JSON.stringify(blank))}'>+ ${addLabel}</button></div>
  ${arr.length ? arr.map((it, i) => `<div class="card item"><div class="item-h"><b>${esc(itemFn.title(it, i))}</b><button class="x" data-del="${arrPath}.${i}" aria-label="Remove">✕</button></div><div class="grid">${itemFn.body(`${arrPath}.${i}`, it, i)}</div></div>`).join('') : `<p class="empty">None added.</p>`}</div>`;
}
const sec = (title, body, sub) => `<section class="card"><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}<div class="grid">${body}</div></section>`;

/* ───── views ───── */
let rT;
function softRender() { clearTimeout(rT); rT = setTimeout(render, 250); }
function render() {
  clearTimeout(rT);
  const ae = document.activeElement, fp = ae && ae.dataset && ae.dataset.p, fsel = fp && ae.selectionStart != null ? [ae.selectionStart, ae.selectionEnd] : null;
  _render();
  if (fp) { const el = document.querySelector(`[data-p="${fp}"]`); if (el) { el.focus({ preventScroll: true }); if (fsel) try { el.setSelectionRange(...fsel); } catch (e) { } } }
}
function _render() {
  const app = $('#app');
  $('#store').textContent = { db: 'Saved to your private Claude account storage', local: 'Saved in this browser only', memory: 'Not saved — storage unavailable' }[state.store];
  if (state.view === 'home' || !cur()) { app.innerHTML = homeView(); $('#bar').innerHTML = ''; return bind(); }
  const r = cur(); const C = compute(r);
  app.innerHTML = r.kind === 'business' ? bizView(r, C) : indView(r, C);
  $('#bar').innerHTML = barView(r, C);
  bind();
}

function homeView() {
  const rets = Object.values(state.returns).sort((a, b) => b.year - a.year || (b.updated || 0) - (a.updated || 0));
  const today = new Date();
  return `<section class="hero"><h1>File, fix and amend your taxes — ${YEARS[YEARS.length - 1]} to ${YEARS[0]}</h1>
  <p>Prepare federal and PA, MD or NJ returns for individuals, sole proprietors and business entities. Type in your numbers or upload W-2s, 1099s and receipts. The app checks for errors and builds a line-by-line return you can file.</p>
  <div class="new"><label>Tax year <select id="nyear">${YEARS.map(y => `<option>${y}</option>`).join('')}</select></label>
  <label>Return type <select id="nkind"><option value="individual">Personal (1040 + state, incl. Schedule C)</option><option value="business">Business entity (1120-S / 1065 / 1120)</option></select></label>
  <button class="btn pri" id="create">Start return</button></div></section>
  <section class="card"><h2>Your returns</h2>${rets.length ? `<div class="list">${rets.map(r => { const C = compute(r); const bal = r.kind === 'business' ? C.B.fedBal : C.F.balance; const errs = C.issues.filter(i => i.sev === 'error').length;
    return `<div class="row"><button class="rowmain" data-open="${r.id}"><span class="yr">${r.year}</span><span><b>${esc(r.label || (r.kind === 'business' ? (r.data.name || 'Business return') : ((r.data.tp.first || 'Personal') + ' ' + (r.data.tp.last || ''))))}</b>
      <small>${r.kind === 'business' ? ENT[r.data.entity] : FS[r.data.fs] + ' · ' + (r.data.resState || '—')}${r.amendedFrom ? ' · <em>Amended</em>' : ''}${r.status === 'filed' ? ' · Filed' : ''}</small></span>
      <span class="amt ${bal >= 0 ? 'pos' : 'neg'}">${bal >= 0 ? 'Refund ' : 'Owe '}${money(Math.abs(bal))}${errs ? `<small class="e">${errs} error${errs > 1 ? 's' : ''}</small>` : '<small class="ok">No errors</small>'}</span></button>
      <div class="rowact"><button class="btn sm" data-amend="${r.id}">Amend</button><button class="btn sm" data-dup="${r.id}">Copy to year…</button><button class="btn sm ghost" data-rm="${r.id}">Delete</button></div></div>`; }).join('')}</div>` : '<p class="empty">No returns yet. Pick a year above to start.</p>'}</section>
  <section class="card"><h2>Deadlines &amp; filing windows <small>as of ${today.toDateString()}</small></h2><div class="dl">${YEARS.map(y => { const D = deadlines(y, 'individual', null, today);
    return `<div class="dli"><b>${y}</b><span>Due ${D.due.toLocaleDateString()}</span><span class="${D.refundClosed ? 'neg' : ''}">Refund claims ${D.refundClosed ? 'closed' : 'open until'} ${D.refundStatute.toLocaleDateString()}</span><span class="${D.efile.ok ? 'pos' : ''}">${D.efile.ok ? 'E-file OK' : 'Paper / later'}</span></div>`; }).join('')}</div></section>
  <section class="card"><h2>Backup &amp; settings</h2><div class="btns"><button class="btn" id="export">${caps.downloads ? 'Download backup (.json)' : 'Copy backup JSON'}</button><label class="btn">Import backup<input type="file" accept=".json,application/json" id="import" hidden></label></div>
  <label class="chk"><input type="checkbox" id="keepSSN" ${state.settings.keepSSN ? 'checked' : ''}> <span>Store full SSNs (off = only last 4 digits are saved; re-enter full numbers when you file)</span></label></section>`;
}

const IND_TABS = [['profile', 'You & family'], ['income', 'Income'], ['business', 'Business (Sch C)'], ['deductions', 'Deductions'], ['credits', 'Credits'], ['pay', 'Payments'], ['state', 'State'], ['docs', 'Upload docs'], ['review', 'Review & file'], ['amend', 'Amend']];
const BIZ_TABS = [['entity', 'Entity'], ['income', 'Income & deductions'], ['owners', 'Owners / K-1'], ['pay', 'Payments'], ['docs', 'Upload docs'], ['review', 'Review & file'], ['amend', 'Amend']];

function tabsBar(r, tabs, issues) {
  const cnt = t => issues.filter(i => i.tab === t && i.sev === 'error').length;
  return `<div class="top"><button class="btn ghost sm" data-home>← All returns</button><div class="ttl"><b>${r.year} ${r.kind === 'business' ? 'Business return' : 'Personal return'}</b>${r.amendedFrom ? '<span class="tag">Amended</span>' : ''}${r.status === 'filed' ? '<span class="tag ok">Filed</span>' : ''}</div></div>
  <nav class="tabs">${tabs.filter(t => t[0] !== 'amend' || r.amendedFrom).map(([k, l]) => `<button class="${state.tab === k ? 'on' : ''}" data-tab="${k}">${l}${cnt(k) ? `<em>${cnt(k)}</em>` : ''}</button>`).join('')}</nav>`;
}

function indView(r, C) {
  if (!IND_TABS.some(t => t[0] === state.tab)) state.tab = 'profile';
  const d = r.data, y = +r.year, t = state.tab;
  let body = '';
  if (t === 'profile') {
    body = sec('Filing status', fld('fs', 'Filing status', { type: 'select', opts: FS }) + fld('resState', 'State of residence', { type: 'select', opts: Object.fromEntries(STATES.map(s => [s, s])) }))
      + sec('Taxpayer', fld('tp.first', 'First name', { type: 'text' }) + fld('tp.last', 'Last name', { type: 'text' }) + fld('tp.ssn', 'SSN / ITIN', { type: 'text', ph: '123-45-6789', max: 11 }) + fld('tp.dob', 'Date of birth', { type: 'date' }) + fld('tp.blind', 'Legally blind', { type: 'check' }) + fld('tp.dependentOfOther', 'Someone else can claim me as a dependent', { type: 'check' }))
      + ((d.fs === 'mfj' || d.fs === 'mfs') ? sec('Spouse', fld('sp.first', 'First name', { type: 'text' }) + fld('sp.last', 'Last name', { type: 'text' }) + fld('sp.ssn', 'SSN / ITIN', { type: 'text', ph: '123-45-6789', max: 11 }) + fld('sp.dob', 'Date of birth', { type: 'date' }) + fld('sp.blind', 'Legally blind', { type: 'check' })) : '')
      + sec('Address', fld('addr.street', 'Street', { type: 'text', wide: true }) + fld('addr.city', 'City', { type: 'text' }) + fld('addr.st', 'State', { type: 'text', max: 2 }) + fld('addr.zip', 'ZIP', { type: 'text', max: 10 }))
      + `<section class="card">${group('Dependents', 'deps', { title: (x, i) => x.name || `Dependent ${i + 1}`, body: p => fld(p + '.name', 'Full name', { type: 'text' }) + fld(p + '.ssn', 'SSN', { type: 'text', max: 11 }) + fld(p + '.rel', 'Relationship', { type: 'select', opts: { son: 'Son', daughter: 'Daughter', stepchild: 'Stepchild', foster: 'Foster child', grandchild: 'Grandchild', sibling: 'Sibling', parent: 'Parent', other: 'Other relative' } }) + fld(p + '.dob', 'Date of birth', { type: 'date' }) + fld(p + '.student', 'Full-time student (19–23)', { type: 'check' }) }, { name: '', ssn: '', rel: 'son', dob: '' }, 'Dependent')}</section>`;
  } else if (t === 'income') {
    const bizOpts = Object.fromEntries((d.biz || []).map((b, i) => [i, b.name || 'Business ' + (i + 1)]));
    body = `<section class="card">${group('W-2 wages', 'w2', { title: (x, i) => x.employer || `W-2 #${i + 1}`, body: p => fld(p + '.employer', 'Employer', { type: 'text' }) + fld(p + '.ein', 'Employer EIN (box b)', { type: 'text', max: 10 }) + fld(p + '.b1', 'Box 1 Wages') + fld(p + '.b2', 'Box 2 Federal tax withheld') + fld(p + '.b3', 'Box 3 Social Security wages') + fld(p + '.b4', 'Box 4 SS tax withheld') + fld(p + '.b5', 'Box 5 Medicare wages') + fld(p + '.b6', 'Box 6 Medicare tax withheld') + fld(p + '.st', 'Box 15 State', { type: 'text', max: 2 }) + fld(p + '.b16', 'Box 16 State wages') + fld(p + '.b17', 'Box 17 State tax withheld') + fld(p + '.b19', 'Box 19 Local tax withheld') }, { employer: '', st: d.resState }, 'W-2')}</section>`
      + `<section class="card">${group('1099-NEC (contract / freelance pay)', 'nec', { title: (x, i) => x.payer || `1099-NEC #${i + 1}`, body: p => fld(p + '.payer', 'Payer', { type: 'text' }) + fld(p + '.amt', 'Box 1 Nonemployee compensation') + fld(p + '.fedWH', 'Box 4 Federal withheld') + ((d.biz || []).length ? fld(p + '.biz', 'Belongs to business', { type: 'select', opts: bizOpts }) : '<p class="warnline">Add a business on the Business tab — this income goes on Schedule C.</p>') }, { payer: '', biz: 0 }, '1099-NEC')}</section>`
      + `<section class="card">${group('1099-INT interest', 'int', { title: (x, i) => x.payer || `1099-INT #${i + 1}`, body: p => fld(p + '.payer', 'Payer', { type: 'text' }) + fld(p + '.amt', 'Taxable interest (box 1 + 3)') + fld(p + '.taxExempt', 'Tax-exempt interest (box 8)') + fld(p + '.fedWH', 'Federal withheld (box 4)') }, { payer: '' }, '1099-INT')}</section>`
      + `<section class="card">${group('1099-DIV dividends', 'div', { title: (x, i) => x.payer || `1099-DIV #${i + 1}`, body: p => fld(p + '.payer', 'Payer', { type: 'text' }) + fld(p + '.ord', 'Ordinary dividends (1a)') + fld(p + '.qual', 'Qualified dividends (1b)') + fld(p + '.capdist', 'Capital gain distributions (2a)') + fld(p + '.fedWH', 'Federal withheld (4)') }, { payer: '' }, '1099-DIV')}</section>`
      + sec('Capital gains & losses (1099-B / Schedule D)', fld('cg.st', 'Net short-term gain (loss)', { help: 'Use a minus sign for losses' }) + fld('cg.lt', 'Net long-term gain (loss)') + fld('cg.carry', 'Capital loss carryover from prior year', { help: 'Enter as a positive number' }))
      + `<section class="card">${group('1099-R retirement & pensions', 'r', { title: (x, i) => x.payer || `1099-R #${i + 1}`, body: p => fld(p + '.payer', 'Payer', { type: 'text' }) + fld(p + '.gross', 'Gross distribution (1)') + fld(p + '.taxable', 'Taxable amount (2a)') + fld(p + '.code', 'Distribution code (7)', { type: 'text', max: 3 }) + fld(p + '.fedWH', 'Federal withheld (4)') + fld(p + '.ira', 'IRA/SEP/SIMPLE box checked', { type: 'check' }) }, { payer: '', code: '7' }, '1099-R')}</section>`
      + sec('Other income', fld('ssa.benefits', 'Social Security benefits (SSA-1099 box 5)') + fld('ssa.fedWH', 'SSA-1099 federal withheld') + fld('g.unemp', 'Unemployment (1099-G box 1)') + fld('g.stRefund', 'Taxable state refund (1099-G box 2)', { help: 'Only if you itemized last year' }) + fld('g.fedWH', '1099-G federal withheld') + fld('rental.net', 'Net rental income (Schedule E)', { help: 'After expenses & depreciation' }) + fld('otherInc', 'Other income', { help: 'Prizes, jury duty, gambling, etc.' }));
  } else if (t === 'business') {
    body = `<section class="card"><p class="sub">Sole proprietorships and single-member LLCs. 1099-NEC income entered on the Income tab is added to the business automatically. S-corps, partnerships and C-corps need a separate Business entity return.</p>${group('Schedule C businesses', 'biz', { title: (x, i) => (x.name || `Business ${i + 1}`) + ' — net ' + money(C.F.biz[i]?.net || 0), body: (p, b, i) => fld(p + '.name', 'Business name', { type: 'text' }) + fld(p + '.ein', 'EIN (optional)', { type: 'text', max: 10 }) + fld(p + '.code', 'Principal activity', { type: 'text', ph: 'e.g. Notary / signing agent' })
      + `<div class="wide note">1099-NEC receipts linked here: <b>${money(C.F.biz[i]?.receipts - N(b.gross) + N(b.returns) || 0)}</b></div>`
      + fld(p + '.gross', 'Other receipts not on a 1099-NEC', { help: 'Cash, checks, Zelle/Venmo, 1099-K' }) + fld(p + '.returns', 'Returns & allowances') + fld(p + '.cogs', 'Cost of goods sold')
      + fld(p + '.exp.adv', 'Advertising') + fld(p + '.exp.car', 'Car & truck', { hint: 'Standard mileage × business miles, or actual expenses' }) + fld(p + '.exp.contract', 'Contract labor') + fld(p + '.exp.ins', 'Insurance (not health)') + fld(p + '.exp.legal', 'Legal & professional') + fld(p + '.exp.office', 'Office expense') + fld(p + '.exp.rent', 'Rent / lease') + fld(p + '.exp.repair', 'Repairs') + fld(p + '.exp.supplies', 'Supplies') + fld(p + '.exp.taxes', 'Taxes & licenses') + fld(p + '.exp.travel', 'Travel') + fld(p + '.exp.meals', 'Business meals (50% deductible)', { help: 'Enter the full amount' }) + fld(p + '.exp.util', 'Utilities / phone') + fld(p + '.exp.wages', 'Employee wages') + fld(p + '.exp.depr', 'Depreciation / Sec. 179') + fld(p + '.exp.other', 'Other expenses') + fld(p + '.homeSqft', 'Home office sq ft (simplified, max 300)', { type: 'pct' }).replace('<span>%</span>', '<span>ft²</span>') }, { name: '', exp: {} }, 'Business')}</section>`;
  } else if (t === 'deductions') {
    const p = P[y];
    body = sec('Adjustments to income (Schedule 1)', fld('adj.hsa', 'HSA contributions (not through payroll)') + fld('adj.ira', `Traditional IRA deduction (limit $${fmt(p.ira)})`) + fld('adj.sli', 'Student loan interest (1098-E)') + fld('adj.educator', 'Educator expenses (K-12 teachers)') + fld('adj.sehi', 'Self-employed health insurance') + fld('adj.sep', 'SEP / SIMPLE / Solo 401(k)'))
      + sec('Itemized deductions (Schedule A)', fld('item.medical', 'Medical & dental expenses', { help: `Only the part over 7.5% of AGI (${money(0.075 * C.F.agi)}) counts` }) + fld('item.salt', 'State & local income (or sales) tax paid') + fld('item.realEstate', 'Real estate / personal property tax') + fld('item.mortgage', 'Mortgage interest (1098)') + fld('item.charityCash', 'Charity — cash') + fld('item.charityNon', 'Charity — goods') + fld('item.other', 'Other itemized') + fld('item.force', 'Itemize even if standard deduction is larger', { type: 'check' }),
        `Standard deduction: <b>${money(C.F.sd)}</b> · Itemized total: <b>${money(C.F.itemTotal)}</b> → using <b>${C.F.itemized ? 'itemized' : 'standard'}</b>. SALT cap: ${money(C.F.saltCap)}.`)
      + (p.obbb ? sec('New deductions for 2025–2028 (Schedule 1-A)', fld('obb.tips', 'Qualified tips (max $25,000)') + fld('obb.overtime', 'Qualified overtime premium pay') + fld('obb.carInt', 'Car loan interest — new US-assembled vehicle (max $10,000)') + `<div class="wide note">Senior deduction ($6,000 per person 65+): <b>${money(C.F.senior)}</b> — applied automatically from date of birth.</div>`) : '');
  } else if (t === 'credits') {
    body = sec('Child Tax Credit / Other Dependents', `<div class="wide note">${C.F.ctcKids} child${C.F.ctcKids === 1 ? '' : 'ren'} qualify for the Child Tax Credit and ${C.F.odcDeps} for the $500 Other Dependent credit, based on the Dependents list (age under ${y === 2021 ? 18 : 17} at year end, child relationship, SSN).</div>` + (y === 2021 ? fld('cr.advCTC', 'Advance CTC payments received in 2021 (Letter 6419)') + fld('cr.rrc', 'Recovery Rebate Credit (3rd stimulus shortfall)') : ''))
      + sec('Child & dependent care', fld('cr.careExp', 'Care expenses paid (daycare, after-school, summer camp)') + fld('cr.careKids', 'Number of children under 13 in care', { type: 'pct' }).replace('<span>%</span>', '<span>#</span>'), `Credit: <b>${money(C.F.care + C.F.careRefundable)}</b>`)
      + `<section class="card">${group('Education (1098-T)', 'cr.students', { title: (x, i) => x.name || `Student ${i + 1}`, body: p => fld(p + '.name', 'Student name', { type: 'text' }) + fld(p + '.exp', 'Qualified tuition & fees paid') + fld(p + '.type', 'Credit', { type: 'select', opts: { aotc: 'American Opportunity (first 4 yrs of college)', llc: 'Lifetime Learning' } }) }, { name: '', type: 'aotc' }, 'Student')}</section>`
      + sec('Earned Income Credit', `<div class="wide note">Estimated automatically: <b>${money(C.F.eitc)}</b>${C.F.eitc ? ` with ${C.F.eitcKids} qualifying child${C.F.eitcKids === 1 ? '' : 'ren'}` : ''}. Children must live with you more than half the year.</div>`);
  } else if (t === 'pay') {
    body = sec('Federal payments', fld('pay.est', 'Estimated tax payments (1040-ES)') + fld('pay.prior', 'Prior-year overpayment applied') + fld('pay.ext', 'Paid with extension (4868)'), `Withholding from your forms: <b>${money(C.F.wh + C.F.addlMedWH)}</b>`);
  } else if (t === 'state') body = stateTab(r, C);
  else if (t === 'docs') body = docsTab(r);
  else if (t === 'review') body = reviewInd(r, C);
  else if (t === 'amend') body = amendTab(r, C);
  return tabsBar(r, IND_TABS, C.issues) + body;
}

function stateTab(r, C) {
  const s = (r.data.resState || '').toUpperCase();
  let inputs = '';
  if (s === 'PA') inputs = fld('st.pa.est', 'PA estimated payments') + fld('st.pa.eit', 'Local Earned Income Tax rate (optional)', { type: 'pct', help: 'For an estimate only — local EIT is filed separately' });
  else if (s === 'MD') inputs = fld('st.md.rate', 'County / Baltimore City local tax rate', { type: 'pct', help: 'From the Form 502 instructions for your county (e.g. Baltimore County 3.20%)' }) + fld('st.md.sub', 'Other MD subtractions', { help: 'Pension exclusion, military pay, etc.' }) + fld('st.md.est', 'MD estimated payments');
  else if (s === 'NJ') inputs = fld('st.nj.propTax', 'Property taxes paid (homeowners)') + fld('st.nj.rent', 'Rent paid (renters — 18% counts as property tax)') + fld('st.nj.est', 'NJ estimated payments');
  else if (!NOTAX.includes(s)) inputs = fld('st.other.rate', `${s} approx. tax rate`, { type: 'pct' }) + fld('st.other.ded', `${s} deductions & exemptions`) + fld('st.other.est', 'State estimated payments');
  const S = C.S;
  return (inputs ? sec(`${s} details`, inputs) : '') + `<section class="card"><h2>${esc(S.form)}</h2>${S.lines.length ? `<table class="lines">${S.lines.map(([l, v]) => `<tr><td>${esc(l)}</td><td>${typeof v === 'number' ? money(v) : esc(v)}</td></tr>`).join('')}</table>` : ''}
  ${(S.extra || []).map(x => `<p class="note">${esc(x)}</p>`).join('')}${S.none ? '' : `<div class="result ${S.bal >= 0 ? 'pos' : 'neg'}">${S.bal >= 0 ? 'State refund' : 'State amount owed'}: <b>${money(Math.abs(S.bal))}</b></div>`}</section>`;
}

function issuesBox(issues) {
  if (!issues.length) return `<div class="card okbox">✓ No problems found.</div>`;
  const ic = { error: '⛔', warn: '⚠️', info: 'ℹ️' };
  return `<section class="card"><h2>Error check <small>${issues.filter(i => i.sev === 'error').length} errors · ${issues.filter(i => i.sev === 'warn').length} warnings</small></h2><ul class="issues">${issues.map(i => `<li class="${i.sev}"><span>${ic[i.sev]}</span><span>${esc(i.msg)}</span>${i.tab && i.tab !== state.tab ? `<button class="btn sm ghost" data-tab="${i.tab}">Fix</button>` : ''}</li>`).join('')}</ul></section>`;
}

function fedLines(F, y) {
  return [['1a Wages (W-2 box 1)', F.wages], ['2a Tax-exempt interest', F.exInt], ['2b Taxable interest', F.taxInt], ['3a Qualified dividends', F.qualDiv], ['3b Ordinary dividends', F.ordDiv],
    ['4b IRA distributions (taxable)', F.iraTax], ['5b Pensions & annuities (taxable)', F.penTax], ['6a Social Security benefits', F.ssBen], ['6b Taxable Social Security', F.ssTax], ['7 Capital gain or (loss)', F.capInc],
    ['8 Additional income (Schedule 1)', F.addInc], ['   · Business income (Schedule C)', F.schC], ['9 Total income', F.totalInc], ['10 Adjustments to income', F.adj], ['11 Adjusted gross income (AGI)', F.agi],
    [`12 ${F.itemized ? 'Itemized deductions (Sch A)' : 'Standard deduction'}${F.nonItemCharity ? ' + charity' : ''}`, F.ded + F.nonItemCharity], ...(F.sch1A ? [['13b Schedule 1-A (tips, overtime, car interest, senior)', F.sch1A]] : []), ['13 QBI deduction', F.qbi],
    ['15 Taxable income', F.ti], ['16 Tax', F.tax], ['19 Child Tax Credit / Other Dependents', F.ctcUsed], ['20 Other credits (Sch 3: child care, education)', F.careUsed + F.eduUsed],
    ['23 Other taxes (Sch 2: SE tax, Add\'l Medicare, NIIT, penalties)', F.otherTaxes], ['   · Self-employment tax', F.seTax], ['24 Total tax', F.totalTax], ['25 Federal income tax withheld', F.wh + F.addlMedWH], ['26 Estimated & extension payments', F.est],
    ['27 Earned income credit', F.eitc], ['28 Additional child tax credit', F.actc + F.ctc2021Ref], ['29 American opportunity credit (refundable)', F.aotcRef], ...(y === 2021 ? [['Recovery rebate / refundable care credit', F.rrc + F.careRefundable]] : []),
    ['33 Total payments', F.totalPay], [F.balance >= 0 ? '34 Overpaid (refund)' : '37 Amount you owe', Math.abs(F.balance)]];
}

function reviewInd(r, C) {
  const F = C.F, S = C.S, y = +r.year, D = deadlines(y, 'individual');
  return issuesBox(C.issues) + `<section class="card sumcard"><div class="big ${F.balance >= 0 ? 'pos' : 'neg'}"><small>Federal</small>${F.balance >= 0 ? 'Refund' : 'You owe'} ${money(Math.abs(F.balance))}</div>
  ${S.none ? '' : `<div class="big ${S.bal >= 0 ? 'pos' : 'neg'}"><small>${S.code}</small>${S.bal >= 0 ? 'Refund' : 'You owe'} ${money(Math.abs(S.bal))}</div>`}
  <div class="kv"><span>AGI</span><b>${money(F.agi)}</b><span>Taxable income</span><b>${money(F.ti)}</b><span>Total federal tax</span><b>${money(F.totalTax)}</b><span>Effective rate</span><b>${(F.effRate * 100).toFixed(1)}%</b><span>Marginal bracket</span><b>${Math.round(F.marginal * 100)}%</b></div></section>
  <section class="card"><h2>Form 1040 — ${y}${r.amendedFrom ? ' (corrected figures for 1040-X)' : ''}</h2><p class="sub">Line numbers follow the 2024–2025 Form 1040 layout; check your year's form, since a few line numbers shift.</p><table class="lines">${fedLines(F, y).map(([l, v]) => `<tr class="${/^(11|15|24|33|34|37) /.test(l) ? 'hl' : ''}"><td>${esc(l)}</td><td>${money(v)}</td></tr>`).join('')}</table></section>
  <section class="card"><h2>Schedules &amp; forms to include</h2><ul class="forms">${formsList(r, F, S).map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
  ${fileBox(r, D, S)}
  <section class="card"><h2>Export</h2><div class="btns"><button class="btn pri" data-export="${r.id}">${caps.downloads ? 'Download filing packet (.html)' : 'Copy filing packet'}</button>
  <button class="btn" data-mark="${r.id}">${r.status === 'filed' ? 'Mark as not filed' : 'Mark as filed'}</button>${!r.amendedFrom && r.status === 'filed' ? `<button class="btn" data-amend="${r.id}">Amend this return</button>` : ''}</div></section>`;
}
function formsList(r, F, S) {
  const d = r.data, L = [r.amendedFrom ? 'Form 1040-X (Amended U.S. Individual Income Tax Return), with corrected schedules' : 'Form 1040'];
  if (F.addInc || F.adj) L.push('Schedule 1 (Additional income & adjustments)');
  if (F.sch1A) L.push('Schedule 1-A (tips, overtime, car loan interest, senior deduction)');
  if (F.otherTaxes) L.push('Schedule 2 (Additional taxes)');
  if (F.careUsed || F.eduUsed) L.push('Schedule 3 (Additional credits)');
  if (F.itemized) L.push('Schedule A (Itemized deductions)');
  if (F.taxInt > 1500 || F.ordDiv > 1500) L.push('Schedule B (Interest & dividends over $1,500)');
  (d.biz || []).forEach(b => L.push(`Schedule C — ${b.name || 'business'}`));
  if (F.seTax) L.push('Schedule SE (Self-employment tax)');
  if (N(d.cg.st) || N(d.cg.lt)) L.push('Schedule D + Form 8949 (Capital gains)');
  if (F.rental) L.push('Schedule E (Rental income)');
  if (F.ctcUsed || F.actc || F.ctc2021Ref) L.push('Schedule 8812 (Child tax credit)');
  if (F.eitc) L.push('Schedule EIC (if qualifying children)');
  if (F.care || F.careRefundable) L.push('Form 2441 (Child & dependent care)');
  if (F.aotcRef || F.eduUsed) L.push('Form 8863 (Education credits)');
  if (F.qbi) L.push('Form 8995 (QBI deduction)');
  if (F.addlMed) L.push('Form 8959 (Additional Medicare tax)');
  if (F.niit) L.push('Form 8960 (Net investment income tax)');
  if (N(d.adj.hsa)) L.push('Form 8889 (HSA)');
  if (F.earlyPen) L.push('Form 5329 (if claiming an early-distribution exception)');
  L.push('Attach copies of W-2s (and 1099s showing withholding) if mailing');
  if (!S.none) L.push(r.amendedFrom ? `${S.code}: ${S.amendForm}` : `${S.code}: ${S.form}${S.code === 'PA' && C_forgiven(S) ? ' + Schedule SP (Tax Forgiveness)' : ''}`);
  return L;
}
function C_forgiven(S) { const l = S.lines.find(x => x[0].includes('forgiveness credit')); return l && l[1] > 0; }
function fileBox(r, D, S) {
  const y = +r.year;
  return `<section class="card"><h2>How to file ${y}</h2><ul class="steps">
  <li><b>Due date:</b> ${D.due.toDateString()}${D.pastDue ? ' (passed)' : ''}. ${r.kind !== 'business' ? `Refund claims for ${y} close ${D.refundStatute.toDateString()}${D.refundClosed ? ' — <span class="neg">already closed</span>' : ''}.` : ''}</li>
  <li><b>E-file:</b> ${esc(D.efile.msg)}</li>
  ${D.efile.ok ? `<li><b>To e-file:</b> transfer these line values into IRS-authorized e-file software (IRS Free File or Free File Fillable Forms for the current year; commercial software for prior years). ${r.amendedFrom ? 'Form 1040-X can be e-filed for the current and two prior years.' : ''}</li>` : ''}
  <li><b>To mail:</b> download the blank ${y} forms from irs.gov/forms (use "Prior Year Forms" for older years), copy the amounts from the packet, sign, and mail to the address in "Where to File" for your state. Write "${y}" and your SSN on any check to the "United States Treasury".</li>
  ${S && !S.none ? `<li><b>${S.code}:</b> file ${esc(r.amendedFrom ? S.amendForm : S.form)} ${S.code === 'PA' ? 'via myPATH (mypath.pa.gov) or paper' : S.code === 'MD' ? 'via iFile/approved software or paper' : S.code === 'NJ' ? 'via NJ Online Filing / approved software or paper' : 'per your state\'s revenue department'}.</li>` : ''}
  <li><b>Pay a balance:</b> IRS Direct Pay (irs.gov/payments) — choose the correct tax year and form.</li></ul></section>`;
}

/* ───── amendment ───── */
function amendTab(r, C) {
  const o = r.original; if (!o) return '<section class="card">Original figures missing.</section>';
  if (r.kind === 'business') {
    const B = C.B; const rows = [['Gross receipts', o.receipts, B.receipts], ['Total income', o.income, B.income], ['Total deductions', o.deductions, B.deductions], ['Ordinary business income (loss)', o.obi, B.obi], ['Federal tax', o.fedTax, B.fedTax], [`${r.data.st} entity tax`, o.stTax, B.stTax]];
    return issuesBox(C.issues) + amendTable(rows, `${esc(B.amendForm)}`) + sec('Explanation of changes', `<label class="f wide"><span class="lbl">What changed and why</span><textarea data-rp="amendReason" rows="4">${esc(r.amendReason || '')}</textarea></label>`) + `<section class="card"><p class="note">Pass-through changes flow to each owner — issue corrected K-1s and owners may need to amend their own returns.</p></section>`;
  }
  const F = C.F, S = C.S;
  const rows = [['1 Adjusted gross income', o.agi, F.agi], ['2 Deductions (std/itemized + QBI + Sch 1-A)', o.ded, F.ded + F.nonItemCharity + F.qbi + F.sch1A], ['5 Taxable income', o.ti, F.ti], ['6 Tax', o.tax, F.tax], ['7 Nonrefundable credits', o.nonref, F.nonref], ['9 Other taxes', o.otherTaxes, F.otherTaxes], ['11 Total tax', o.totalTax, F.totalTax],
    ['12 Withholding', o.wh, F.wh + F.addlMedWH], ['13 Estimated payments', o.est, F.est], ['15 Refundable credits', o.refundable, F.refundable], ['Federal refund (+) / owed (−)', o.balance, F.balance]];
  const diff = F.balance - o.balance;
  const stDiff = S.none ? 0 : S.bal - (o.stBal || 0);
  return issuesBox(C.issues) + amendTable(rows, 'Form 1040-X — Column A (original) · B (change) · C (correct)')
    + `<section class="card sumcard"><div class="big ${diff >= 0 ? 'pos' : 'neg'}"><small>Federal amendment result</small>${Math.abs(diff) < 1 ? 'No change' : (diff > 0 ? 'Additional refund ' : 'Additional tax due ') + money(Math.abs(diff))}</div>${S.none ? '' : `<div class="big ${stDiff >= 0 ? 'pos' : 'neg'}"><small>${S.code} (${esc(S.amendForm)})</small>${Math.abs(stDiff) < 1 ? 'No change' : (stDiff > 0 ? 'Additional refund ' : 'Additional due ') + money(Math.abs(stDiff))}</div>`}
    <p class="note">Assumes the original return was filed as shown in Column A and any refund/balance was settled. If the IRS adjusted your original return, use their figures.</p></section>`
    + sec('Part II — Explanation of changes (required)', `<label class="f wide"><span class="lbl">What changed and why</span><textarea data-rp="amendReason" rows="4" placeholder="e.g. Received a corrected W-2 from employer; added 1099-NEC income omitted from original return.">${esc(r.amendReason || '')}</textarea></label>`)
    + (+r.year === 2021 || +r.year >= 2022 ? '' : '');
}
const amendTable = (rows, title) => `<section class="card"><h2>${title}</h2><table class="lines amend"><tr><th></th><th>A Original</th><th>B Change</th><th>C Correct</th></tr>${rows.map(([l, a, c]) => `<tr><td>${esc(l)}</td><td>${money(a)}</td><td class="${c - a > 0 ? 'up' : c - a < 0 ? 'down' : ''}">${c - a ? (c - a > 0 ? '+' : '') + money(c - a) : '—'}</td><td><b>${money(c)}</b></td></tr>`).join('')}</table></section>`;

function startAmend(id) {
  const src = state.returns[id]; const C = compute(src);
  const copy = JSON.parse(JSON.stringify(src)); copy.id = uid(); copy.amendedFrom = id; copy.status = 'draft'; copy.amendReason = ''; copy.created = Date.now();
  copy.label = (src.label || '') + ' (amended)';
  if (src.kind === 'business') copy.original = (({ receipts, income, deductions, obi, fedTax, stTax }) => ({ receipts, income, deductions, obi, fedTax, stTax }))(C.B);
  else { const F = C.F; copy.original = { agi: F.agi, ded: F.ded + F.nonItemCharity + F.qbi + F.sch1A, ti: F.ti, tax: F.tax, nonref: F.nonref, otherTaxes: F.otherTaxes, totalTax: F.totalTax, wh: F.wh + F.addlMedWH, est: F.est, refundable: F.refundable, balance: F.balance, stBal: C.S.bal }; }
  state.returns[copy.id] = copy; save(copy); go('ret', copy.id, src.kind === 'business' ? 'income' : 'income'); toast('Amended copy created — change what was wrong, then check the Amend tab.');
}

/* ───── business entity view ───── */
function bizView(r, C) {
  if (!BIZ_TABS.some(t => t[0] === state.tab)) state.tab = 'entity';
  const t = state.tab, B = C.B, d = r.data; let body = '';
  if (t === 'entity') body = sec('Entity', fld('entity', 'Entity type', { type: 'select', opts: ENT }) + fld('name', 'Legal business name', { type: 'text' }) + fld('ein', 'EIN', { type: 'text', ph: '12-3456789', max: 10 }) + fld('st', 'State', { type: 'select', opts: Object.fromEntries(STATES.map(s => [s, s])) }), 'Sole proprietors and single-member LLCs file Schedule C inside a Personal return instead.');
  else if (t === 'income') body = sec('Income', fld('gross', 'Gross receipts or sales') + fld('returns', 'Returns & allowances') + fld('cogs', 'Cost of goods sold') + fld('otherInc', 'Other income'))
    + sec('Deductions', fld('ded.officer', 'Officer compensation (W-2)') + fld('ded.salaries', 'Salaries & wages') + (d.entity === 'partnership' ? fld('ded.guaranteed', 'Guaranteed payments to partners') : '') + fld('ded.repairs', 'Repairs & maintenance') + fld('ded.badDebt', 'Bad debts') + fld('ded.rent', 'Rents') + fld('ded.taxes', 'Taxes & licenses') + fld('ded.interest', 'Interest') + fld('ded.depr', 'Depreciation (Form 4562)') + fld('ded.adv', 'Advertising') + fld('ded.pension', 'Retirement plans') + fld('ded.benefits', 'Employee benefits') + fld('ded.other', 'Other deductions'), `Ordinary business income: <b>${money(B.obi)}</b>`);
  else if (t === 'owners') body = `<section class="card">${group(d.entity === 'ccorp' ? 'Shareholders' : 'Owners (K-1 recipients)', 'owners', { title: (x, i) => (x.name || `Owner ${i + 1}`) + ` — ${N(x.pct)}%`, body: p => fld(p + '.name', 'Name', { type: 'text' }) + fld(p + '.pct', 'Ownership %', { type: 'pct' }) }, { name: '', pct: '' }, 'Owner')}</section>`
    + (d.entity !== 'ccorp' ? `<section class="card"><h2>K-1 allocation</h2><table class="lines">${B.k1.map(k => `<tr><td>${esc(k.name)} (${k.pct}%)</td><td>${money(k.share)}</td></tr>`).join('')}</table><p class="note">Each owner reports their share on their personal return (Schedule E). ${d.entity === 'partnership' ? 'General partners also owe self-employment tax on their share plus guaranteed payments.' : 'S-corp distributions are not subject to SE tax; shareholder wages run through payroll.'}</p></section>` : '');
  else if (t === 'pay') body = sec('Payments', fld('pay.est', 'Federal estimated payments') + fld('pay.stEst', 'State estimated payments'));
  else if (t === 'docs') body = docsTab(r);
  else if (t === 'review') {
    const D = deadlines(+r.year, 'business', d.entity);
    body = issuesBox(C.issues) + `<section class="card sumcard"><div class="big ${B.fedBal >= 0 ? 'pos' : 'neg'}"><small>Federal (${B.form})</small>${d.entity === 'ccorp' ? (B.fedBal >= 0 ? 'Refund ' : 'Owe ') + money(Math.abs(B.fedBal)) : 'No entity tax — passes through'}</div><div class="big ${B.stBal >= 0 ? 'pos' : 'neg'}"><small>${esc(B.stForm)}</small>${B.stTax ? (B.stBal >= 0 ? 'Refund ' : 'Owe ') + money(Math.abs(B.stBal)) : 'No entity tax'}</div></section>
    <section class="card"><h2>${B.form} summary</h2><table class="lines">${[['1c Net receipts', B.receipts], ['2 Cost of goods sold', N(d.cogs)], ['3 Gross profit', B.gp], ['Total income', B.income], ['Total deductions', B.deductions], [d.entity === 'ccorp' ? '30 Taxable income' : 'Ordinary business income (loss)', B.obi], ...(d.entity === 'ccorp' ? [['31 Tax (21%)', B.fedTax], ['Estimated payments', B.fedPay]] : [])].map(([l, v]) => `<tr><td>${l}</td><td>${money(v)}</td></tr>`).join('')}</table>${B.stNote ? `<p class="note">${esc(B.stNote)}</p>` : ''}</section>
    ${fileBox(r, D, null)}<section class="card"><h2>Export</h2><div class="btns"><button class="btn pri" data-export="${r.id}">${caps.downloads ? 'Download filing packet (.html)' : 'Copy filing packet'}</button><button class="btn" data-mark="${r.id}">${r.status === 'filed' ? 'Mark as not filed' : 'Mark as filed'}</button></div></section>`;
  } else if (t === 'amend') body = amendTab(r, C);
  return tabsBar(r, BIZ_TABS, C.issues) + body;
}

function barView(r, C) {
  const errs = C.issues.filter(i => i.sev === 'error').length;
  if (r.kind === 'business') { const B = C.B; return `<button data-tab="review"><span>Federal <b class="${B.fedBal >= 0 ? 'pos' : 'neg'}">${r.data.entity === 'ccorp' ? money(B.fedBal) : 'Pass-through'}</b></span><span>OBI <b>${money(B.obi)}</b></span><span class="${errs ? 'e' : 'ok'}">${errs ? errs + ' error' + (errs > 1 ? 's' : '') : '✓ No errors'}</span></button>`; }
  const F = C.F, S = C.S;
  return `<button data-tab="review"><span>Federal <b class="${F.balance >= 0 ? 'pos' : 'neg'}">${F.balance >= 0 ? '+' : ''}${money(F.balance)}</b></span>${S.none ? '' : `<span>${S.code} <b class="${S.bal >= 0 ? 'pos' : 'neg'}">${S.bal >= 0 ? '+' : ''}${money(S.bal)}</b></span>`}<span class="${errs ? 'e' : 'ok'}">${errs ? errs + ' error' + (errs > 1 ? 's' : '') : '✓ No errors'}</span></button>`;
}

/* ───── documents (AI extraction) ───── */
function docsTab(r) {
  const res = state.docs[r.id] || {};
  const avail = !!caps.sample;
  return `<section class="card"><h2>Upload tax documents</h2>
  <p class="sub">Photos or PDFs of W-2, 1099-NEC/INT/DIV/B/R/G/K, SSA-1099, 1098, 1098-T, 1098-E, K-1s, receipts or expense summaries. Claude reads them and fills the right fields; you review every value before it's added.</p>
  ${avail ? `<label class="drop" id="drop"><input type="file" id="docfile" multiple accept="image/*,application/pdf" hidden><b>Tap to choose files</b> or drop them here<small>${caps.images ? `Up to ${caps.images.maxCount} pages per batch` : 'PDF text will be read'}</small></label>` : `<p class="warnline">Document reading isn't available in this view (it needs to be opened inside Claude, signed in). Enter values manually on the other tabs.</p>`}
  ${res.status ? `<p class="status">${esc(res.status)}</p>` : ''}
  ${res.docs ? res.docs.map((doc, i) => docCard(r, doc, i)).join('') : ''}</section>
  <section class="card"><p class="note">Files are read in your browser and sent only to Claude for extraction; images aren't stored. Only the values you accept are saved to the return. Full SSNs are not extracted (last 4 only).</p></section>`;
}
const FORM_FIELDS = {
  'W-2': [['employer', 'Employer'], ['ein', 'EIN'], ['b1', 'Box 1'], ['b2', 'Box 2'], ['b3', 'Box 3'], ['b4', 'Box 4'], ['b5', 'Box 5'], ['b6', 'Box 6'], ['st', 'State'], ['b16', 'Box 16'], ['b17', 'Box 17'], ['b19', 'Box 19']],
  '1099-NEC': [['payer', 'Payer'], ['amt', 'Box 1'], ['fedWH', 'Box 4']], '1099-K': [['payer', 'Payer'], ['amt', 'Box 1a gross']], '1099-MISC': [['payer', 'Payer'], ['amt', 'Amount'], ['rents', 'Rents (1)'], ['fedWH', 'Box 4']],
  '1099-INT': [['payer', 'Payer'], ['amt', 'Taxable interest'], ['taxExempt', 'Tax-exempt'], ['fedWH', 'Fed withheld']], '1099-DIV': [['payer', 'Payer'], ['ord', '1a'], ['qual', '1b'], ['capdist', '2a'], ['fedWH', '4']],
  '1099-B': [['payer', 'Broker'], ['st', 'Net short-term'], ['lt', 'Net long-term']], '1099-G': [['payer', 'Payer'], ['unemp', 'Unemployment'], ['stRefund', 'State refund'], ['fedWH', 'Fed withheld']],
  '1099-R': [['payer', 'Payer'], ['gross', 'Gross (1)'], ['taxable', 'Taxable (2a)'], ['code', 'Code (7)'], ['fedWH', 'Fed withheld'], ['ira', 'IRA']], 'SSA-1099': [['benefits', 'Net benefits (5)'], ['fedWH', 'Withheld (6)']],
  '1098': [['payer', 'Lender'], ['mortgage', 'Mortgage interest (1)'], ['realEstate', 'Property tax']], '1098-T': [['payer', 'School'], ['student', 'Student'], ['exp', 'Tuition (1)']], '1098-E': [['payer', 'Lender'], ['sli', 'Interest (1)']],
  'K-1': [['payer', 'Entity'], ['ordinary', 'Ordinary income'], ['interest', 'Interest'], ['dividends', 'Dividends']], 'Receipt': [['payer', 'Vendor'], ['category', 'Category'], ['amt', 'Amount']],
};
function docCard(r, doc, i) {
  const fields = FORM_FIELDS[doc.form] || Object.keys(doc.fields || {}).map(k => [k, k]);
  const yrWarn = doc.taxYear && +doc.taxYear !== +r.year ? `<p class="warnline">This document is for ${doc.taxYear}, not ${r.year}.</p>` : '';
  return `<div class="card item doc ${doc.added ? 'added' : ''}"><div class="item-h"><b>${esc(doc.form)} — ${esc(doc.payer || '')}</b><small>${esc(doc.confidence || '')} confidence</small></div>${yrWarn}
  <div class="grid">${fields.map(([k, l]) => `<label class="f"><span class="lbl">${esc(l)}</span><input type="text" data-docf="${i}.${k}" value="${esc(doc.fields?.[k] ?? (k === 'payer' ? doc.payer : '') ?? '')}"></label>`).join('')}</div>
  ${doc.notes ? `<p class="note">${esc(doc.notes)}</p>` : ''}<div class="btns">${doc.added ? '<span class="ok">✓ Added to return</span>' : `<button class="btn pri sm" data-accept="${i}">Add to return</button><button class="btn sm ghost" data-skip="${i}">Discard</button>`}</div></div>`;
}
async function fileToImages(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (!window.pdfjsLib) throw new Error('PDF reader failed to load — upload photos instead.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const out = { images: [], text: '' };
    for (let n = 1; n <= Math.min(pdf.numPages, 12); n++) {
      const page = await pdf.getPage(n);
      const tc = await page.getTextContent(); out.text += `\n--- ${file.name} page ${n} ---\n` + tc.items.map(i => i.str).join(' ');
      const vp = page.getViewport({ scale: 1 }); const scale = Math.min(2, 1600 / vp.width);
      const v2 = page.getViewport({ scale }); const c = document.createElement('canvas'); c.width = v2.width; c.height = v2.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: v2 }).promise;
      out.images.push(await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85)));
    }
    return out;
  }
  return { images: [file], text: '' };
}
async function extractDocs(files) {
  const r = cur(); const st = state.docs[r.id] = state.docs[r.id] || { docs: [] };
  st.status = 'Reading files…'; render();
  try {
    let imgs = [], text = '';
    for (const f of files) { const o = await fileToImages(f); imgs.push(...o.images); text += o.text; }
    const max = caps.images?.maxCount || 0;
    const batches = []; if (max && imgs.length) for (let i = 0; i < imgs.length; i += max) batches.push(imgs.slice(i, i + max)); else batches.push([]);
    for (let b = 0; b < batches.length; b++) {
      st.status = `Claude is reading your documents${batches.length > 1 ? ` (batch ${b + 1} of ${batches.length})` : ''}… this can take up to a minute.`; render();
      const prompt = `You are extracting data from US tax documents for tax year ${r.year}. The attached images${text ? ' and extracted PDF text below' : ''} are pages of documents the user uploaded.
Identify every tax form or receipt present. Return ONLY JSON in this shape:
{"documents":[{"form":"W-2","taxYear":2025,"payer":"name of employer/payer/vendor","confidence":"high|medium|low","fields":{...},"notes":"anything unclear"}]}
Allowed form values and their field keys (numbers as plain numbers, no $ or commas; omit fields you can't read — never guess):
W-2: employer, ein, b1,b2,b3,b4,b5,b6, st (2-letter state, box 15), b16, b17, b19
1099-NEC: amt (box 1), fedWH (box 4)
1099-K: amt (box 1a)
1099-MISC: amt (other income box 3), rents (box 1), fedWH (box 4)
1099-INT: amt (box 1 + box 3), taxExempt (box 8), fedWH (box 4)
1099-DIV: ord (1a), qual (1b), capdist (2a), fedWH (4)
1099-B: st (total net short-term gain or loss), lt (total net long-term gain or loss)
1099-G: unemp (box 1), stRefund (box 2), fedWH (box 4)
1099-R: gross (1), taxable (2a), code (box 7 text), fedWH (4), ira (true if IRA/SEP/SIMPLE box checked)
SSA-1099: benefits (box 5), fedWH (box 6)
1098: mortgage (box 1), realEstate (property tax if shown)
1098-T: student (name), exp (box 1)
1098-E: sli (box 1)
K-1: ordinary (box 1), interest, dividends
Receipt: category (one of adv, car, contract, ins, legal, office, rent, repair, supplies, taxes, travel, meals, util, wages, other), amt (total)
Never return full Social Security numbers. If a page is not a tax document, skip it.${text ? '\n\nPDF text:\n' + text.slice(0, 60000) : ''}`;
      const opts = { modelTier: 'default', cache: false };
      if (batches[b].length && caps.images) opts.images = batches[b];
      const res = await caps.sample.json(prompt, opts);
      (res?.documents || []).forEach(x => st.docs.push(x));
    }
    st.status = st.docs.length ? `Found ${st.docs.length} document${st.docs.length > 1 ? 's' : ''}. Check each value, then tap "Add to return".` : 'No tax forms were recognized. Try a clearer photo.';
  } catch (e) {
    st.status = ({ not_granted: 'Claude access was declined for this page.', rate_limited: 'Too many requests — wait a minute and try again.', invalid_json: 'Couldn\'t read the result — try again with fewer pages.', image_rejected: 'One of the files couldn\'t be used — try a JPG/PNG photo.' }[e?.code]) || ('Couldn\'t read the documents: ' + (e?.message || e));
  }
  render();
}
function acceptDoc(i) {
  const r = cur(), d = r.data, doc = state.docs[r.id].docs[i], f = doc.fields || {}, n = k => f[k] ?? '';
  const push = (k, o) => { d[k] = d[k] || []; d[k].push(o); };
  const add = (path, v) => set(d, path, String(N(get(d, path)) + N(v)));
  if (r.kind === 'business') {
    if (doc.form === 'Receipt') { const map = { adv: 'adv', rent: 'rent', repair: 'repairs', taxes: 'taxes', wages: 'salaries' }; add('ded.' + (map[f.category] || 'other'), f.amt); }
    else if (['1099-NEC', '1099-K', '1099-MISC'].includes(doc.form)) add('gross', f.amt);
    else { toast('This form belongs on a personal return.'); return; }
  } else switch (doc.form) {
    case 'W-2': push('w2', { employer: n('employer') || doc.payer, ein: n('ein'), b1: n('b1'), b2: n('b2'), b3: n('b3'), b4: n('b4'), b5: n('b5'), b6: n('b6'), st: n('st'), b16: n('b16'), b17: n('b17'), b19: n('b19') }); break;
    case '1099-NEC': if (!(d.biz || []).length) d.biz = [{ name: 'My business', exp: {} }]; push('nec', { payer: n('payer') || doc.payer, amt: n('amt'), fedWH: n('fedWH'), biz: 0 }); break;
    case '1099-K': if (!(d.biz || []).length) d.biz = [{ name: 'My business', exp: {} }]; add('biz.0.gross', f.amt); break;
    case '1099-MISC': if (N(f.rents)) add('rental.net', f.rents); if (N(f.amt)) add('otherInc', f.amt); break;
    case '1099-INT': push('int', { payer: n('payer') || doc.payer, amt: n('amt'), taxExempt: n('taxExempt'), fedWH: n('fedWH') }); break;
    case '1099-DIV': push('div', { payer: n('payer') || doc.payer, ord: n('ord'), qual: n('qual'), capdist: n('capdist'), fedWH: n('fedWH') }); break;
    case '1099-B': add('cg.st', f.st); add('cg.lt', f.lt); break;
    case '1099-G': add('g.unemp', f.unemp); add('g.stRefund', f.stRefund); add('g.fedWH', f.fedWH); break;
    case '1099-R': push('r', { payer: n('payer') || doc.payer, gross: n('gross'), taxable: n('taxable'), code: n('code'), fedWH: n('fedWH'), ira: f.ira === true || f.ira === 'true' }); break;
    case 'SSA-1099': add('ssa.benefits', f.benefits); add('ssa.fedWH', f.fedWH); break;
    case '1098': add('item.mortgage', f.mortgage); add('item.realEstate', f.realEstate); break;
    case '1098-T': d.cr.students = d.cr.students || []; d.cr.students.push({ name: n('student'), exp: n('exp'), type: 'aotc' }); break;
    case '1098-E': add('adj.sli', f.sli); break;
    case 'K-1': add('rental.net', f.ordinary); if (N(f.interest)) push('int', { payer: doc.payer, amt: n('interest') }); if (N(f.dividends)) push('div', { payer: doc.payer, ord: n('dividends') }); toast('K-1 ordinary income added to the Schedule E line — review on the Income tab.'); break;
    case 'Receipt': if (!(d.biz || []).length) d.biz = [{ name: 'My business', exp: {} }]; add('biz.0.exp.' + (f.category || 'other'), f.amt); break;
    default: toast('Unrecognized form — enter it manually.'); return;
  }
  doc.added = true; save(r); render(); toast(`${doc.form} added.`);
}

/* ───── export packet ───── */
function packetHTML(r) {
  const C = compute(r); const y = r.year; const d = r.data;
  let body = '';
  if (r.kind === 'business') { const B = C.B; body = `<h2>${B.form} — ${esc(d.name)} (EIN ${esc(d.ein)})</h2><table>${[['Net receipts', B.receipts], ['Gross profit', B.gp], ['Total income', B.income], ['Total deductions', B.deductions], ['Ordinary business income', B.obi], ['Federal tax', B.fedTax], ['Federal balance', B.fedBal], [B.stForm, B.stTax], ['State balance', B.stBal]].map(([l, v]) => `<tr><td>${esc(l)}</td><td>${money(v)}</td></tr>`).join('')}</table><h3>K-1 allocations</h3><table>${B.k1.map(k => `<tr><td>${esc(k.name)} ${k.pct}%</td><td>${money(k.share)}</td></tr>`).join('')}</table>`; }
  else { const F = C.F, S = C.S; body = `<h2>Form 1040 — ${y} — ${esc(d.tp.first)} ${esc(d.tp.last)} (${FS[d.fs]})</h2><table>${fedLines(F, +y).map(([l, v]) => `<tr><td>${esc(l)}</td><td>${money(v)}</td></tr>`).join('')}</table>
    ${(d.biz || []).map((b, i) => `<h3>Schedule C — ${esc(b.name)}</h3><table><tr><td>Gross receipts</td><td>${money(F.biz[i].receipts)}</td></tr><tr><td>Gross profit</td><td>${money(F.biz[i].gp)}</td></tr><tr><td>Total expenses (incl. home office)</td><td>${money(F.biz[i].exp + F.biz[i].home)}</td></tr><tr><td>Net profit</td><td>${money(F.biz[i].net)}</td></tr></table>`).join('')}
    ${S.none ? '' : `<h2>${esc(S.form)}</h2><table>${S.lines.map(([l, v]) => `<tr><td>${esc(l)}</td><td>${typeof v === 'number' ? money(v) : esc(v)}</td></tr>`).join('')}<tr><td><b>${S.bal >= 0 ? 'Refund' : 'Amount owed'}</b></td><td><b>${money(Math.abs(S.bal))}</b></td></tr></table>`}
    <h3>Forms to include</h3><ul>${formsList(r, F, S).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    if (r.amendedFrom && r.original) { const o = r.original; body += `<h2>Form 1040-X summary</h2><table><tr><th></th><th>Original</th><th>Correct</th></tr>${[['AGI', o.agi, F.agi], ['Taxable income', o.ti, F.ti], ['Total tax', o.totalTax, F.totalTax], ['Refund(+)/Owed(−)', o.balance, F.balance]].map(([l, a, c]) => `<tr><td>${l}</td><td>${money(a)}</td><td>${money(c)}</td></tr>`).join('')}</table><p><b>Explanation:</b> ${esc(r.amendReason)}</p>`; }
  }
  const iss = C.issues.map(i => `<li>[${i.sev.toUpperCase()}] ${esc(i.msg)}</li>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${y} tax packet</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:24px auto;color:#111}table{width:100%;border-collapse:collapse;margin:8px 0 18px}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}td:last-child{text-align:right;font-variant-numeric:tabular-nums}h2{border-bottom:2px solid #111;padding-bottom:4px}</style></head><body><h1>Tax year ${y} filing packet${r.amendedFrom ? ' — AMENDED' : ''}</h1><p>Prepared ${new Date().toLocaleString()} with TaxDesk. Copy these amounts onto the official forms or into IRS-authorized e-file software. Review all figures before filing.</p>${body}${iss ? `<h3>Open issues</h3><ul>${iss}</ul>` : ''}</body></html>`;
}
async function exportPacket(id) {
  const r = state.returns[id]; const html = packetHTML(r);
  const name = `${r.year}_${r.kind === 'business' ? (r.data.name || 'business').replace(/\W+/g, '_') : 'personal'}${r.amendedFrom ? '_amended' : ''}_tax_packet.html`;
  if (caps.downloads) { try { await caps.downloads.save({ filename: name, data: html }); } catch (e) { if (e.code !== 'declined') toast('Download failed: ' + e.code); } }
  else { try { await navigator.clipboard.writeText(html); toast('Packet HTML copied to clipboard.'); } catch (e) { toast('Copy failed.'); } }
}
async function exportBackup() {
  const data = JSON.stringify({ app: 'TaxDesk', exported: new Date().toISOString(), returns: Object.values(state.returns).map(maskSSNs) }, null, 1);
  if (caps.downloads) { try { await caps.downloads.save({ filename: 'taxdesk_backup.json', data }); } catch (e) { if (e.code !== 'declined') toast('Download failed: ' + e.code); } }
  else { try { await navigator.clipboard.writeText(data); toast('Backup JSON copied.'); } catch (e) { toast('Copy failed.'); } }
}

/* ───── modal (copy to year) ───── */
function modal(html) { $('#modal').innerHTML = `<div class="mbg"><div class="mbox">${html}</div></div>`; }
function closeModal() { $('#modal').innerHTML = ''; }

/* ───── event binding ───── */
function bind() {
  document.querySelectorAll('[data-p]').forEach(el => {
    const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      const r = cur(); const v = el.type === 'checkbox' ? el.checked : el.value;
      set(r.data, el.dataset.p, v); save(r);
      if (ev === 'change') render(); else { const C = compute(r); $('#bar').innerHTML = barView(r, C); bindBar(); }
    });
    if (ev === 'input') el.addEventListener('change', softRender);
  });
  document.querySelectorAll('[data-rp]').forEach(el => el.addEventListener('input', () => { const r = cur(); r[el.dataset.rp] = el.value; save(r); }));
  document.querySelectorAll('[data-docf]').forEach(el => el.addEventListener('input', () => { const [i, k] = el.dataset.docf.split('.'); const doc = state.docs[cur().id].docs[+i]; doc.fields = doc.fields || {}; doc.fields[k] = el.value; }));
  document.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => go('ret', null, el.dataset.tab)));
  document.querySelectorAll('[data-home]').forEach(el => el.addEventListener('click', () => go('home')));
  document.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => { const r = state.returns[el.dataset.open]; go('ret', r.id, r.kind === 'business' ? 'entity' : 'profile'); }));
  document.querySelectorAll('[data-add]').forEach(el => el.addEventListener('click', () => { const r = cur(); const a = get(r.data, el.dataset.add) || []; a.push(JSON.parse(el.dataset.blank)); set(r.data, el.dataset.add, a); save(r); render(); }));
  document.querySelectorAll('[data-del]').forEach(el => el.addEventListener('click', () => { const r = cur(); const parts = el.dataset.del.split('.'); const i = +parts.pop(); const a = get(r.data, parts.join('.')); a.splice(i, 1); save(r); render(); }));
  document.querySelectorAll('[data-amend]').forEach(el => el.addEventListener('click', () => startAmend(el.dataset.amend)));
  document.querySelectorAll('[data-export]').forEach(el => el.addEventListener('click', () => exportPacket(el.dataset.export)));
  document.querySelectorAll('[data-mark]').forEach(el => el.addEventListener('click', () => { const r = state.returns[el.dataset.mark]; r.status = r.status === 'filed' ? 'draft' : 'filed'; save(r); render(); }));
  document.querySelectorAll('[data-rm]').forEach(el => el.addEventListener('click', () => { const r = state.returns[el.dataset.rm]; modal(`<h3>Delete the ${r.year} return?</h3><p>This can't be undone.</p><div class="btns"><button class="btn danger" id="mok">Delete</button><button class="btn" id="mno">Cancel</button></div>`); $('#mok').onclick = async () => { await removeRet(r.id); closeModal(); render(); }; $('#mno').onclick = closeModal; }));
  document.querySelectorAll('[data-dup]').forEach(el => el.addEventListener('click', () => { const r = state.returns[el.dataset.dup]; modal(`<h3>Copy to another year</h3><p>Carries over names, dependents, businesses and payers with amounts cleared — handy for filing several years.</p><label class="f"><span class="lbl">Tax year</span><select id="dy">${YEARS.filter(y => y !== +r.year).map(y => `<option>${y}</option>`).join('')}</select></label><div class="btns"><button class="btn pri" id="mok">Copy</button><button class="btn" id="mno">Cancel</button></div>`); $('#mno').onclick = closeModal; $('#mok').onclick = () => { const c = JSON.parse(JSON.stringify(r)); c.id = uid(); c.year = +$('#dy').value; c.status = 'draft'; delete c.amendedFrom; delete c.original; c.amendReason = ''; clearAmounts(c.data); if (c.kind !== 'business') c.data.cg = { st: '', lt: '', carry: '' }; state.returns[c.id] = c; save(c); closeModal(); go('ret', c.id, c.kind === 'business' ? 'entity' : 'profile'); }; }));
  document.querySelectorAll('[data-accept]').forEach(el => el.addEventListener('click', () => acceptDoc(+el.dataset.accept)));
  document.querySelectorAll('[data-skip]').forEach(el => el.addEventListener('click', () => { state.docs[cur().id].docs.splice(+el.dataset.skip, 1); render(); }));
  const cr = $('#create'); if (cr) cr.onclick = () => { const kind = $('#nkind').value; const r = { id: uid(), kind, year: +$('#nyear').value, status: 'draft', created: Date.now(), data: kind === 'business' ? emptyBusiness() : emptyIndividual() }; state.returns[r.id] = r; save(r); go('ret', r.id, kind === 'business' ? 'entity' : 'profile'); };
  const ex = $('#export'); if (ex) ex.onclick = exportBackup;
  const im = $('#import'); if (im) im.onchange = async () => { try { const j = JSON.parse(await im.files[0].text()); (j.returns || []).forEach(r => { if (r && r.id && r.data) { state.returns[r.id] = r; save(r); } }); toast(`Imported ${(j.returns || []).length} return(s).`); render(); } catch (e) { toast('That file isn\'t a TaxDesk backup.'); } };
  const ks = $('#keepSSN'); if (ks) ks.onchange = () => { state.settings.keepSSN = ks.checked; saveSettings(); Object.values(state.returns).forEach(save); };
  const df = $('#docfile'); if (df) df.onchange = () => df.files.length && extractDocs([...df.files]);
  const dr = $('#drop'); if (dr) { dr.addEventListener('dragover', e => { e.preventDefault(); dr.classList.add('hov'); }); dr.addEventListener('dragleave', () => dr.classList.remove('hov')); dr.addEventListener('drop', e => { e.preventDefault(); dr.classList.remove('hov'); extractDocs([...e.dataTransfer.files]); }); }
  bindBar();
}
function bindBar() { document.querySelectorAll('#bar [data-tab]').forEach(el => el.onclick = () => go('ret', null, el.dataset.tab)); }
function clearAmounts(o) { const keep = /^(first|last|ssn|dob|name|rel|employer|ein|payer|st|code|type|entity|fs|resState|street|city|zip|pct|blind|student|ira|dependentOfOther|force|biz|rate)$/; for (const k in o) { if (o[k] && typeof o[k] === 'object') clearAmounts(o[k]); else if (!keep.test(k)) o[k] = ''; } }

render(); initStore(); initCaps();
