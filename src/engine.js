/* TaxDesk calculation engine — federal 1040, PA/MD/NJ resident returns, business entities, validation */
const RATES = [.10, .12, .22, .24, .32, .35, .37];
const YEARS = [2026, 2025, 2024, 2023, 2022, 2021];

// Federal parameters by tax year. br = top of 10/12/22/24/32/35% brackets. cg = [top of 0%, top of 15%].
const P = {
  2021: { sd: { single: 12550, mfj: 25100, mfs: 12550, hoh: 18800, qss: 25100 }, add: [1350, 1700], depSD: [1100, 350],
    br: { single: [9950, 40525, 86375, 164925, 209425, 523600], mfj: [19900, 81050, 172750, 329850, 418850, 628300], hoh: [14200, 54200, 86350, 164900, 209400, 523600], mfs: [9950, 40525, 86375, 164925, 209425, 314150] },
    cg: { single: [40400, 445850], mfj: [80800, 501600], hoh: [54100, 473750], mfs: [40400, 250800] },
    ssBase: 142800, ctc: 2000, actc: 0, salt: [10000, 0], ira: 6000, sli: [70000, 85000, 140000, 170000], qbi: [164900, 329800],
    eitc: { max: [1502, 3618, 5980, 6728], ei: [9820, 10640, 14950, 14950], po: [11610, 19520, 19520, 19520], poJ: [17560, 25470, 25470, 25470], inv: 10000, inRate0: .153, outRate0: .153 } },
  2022: { sd: { single: 12950, mfj: 25900, mfs: 12950, hoh: 19400, qss: 25900 }, add: [1400, 1750], depSD: [1150, 400],
    br: { single: [10275, 41775, 89075, 170050, 215950, 539900], mfj: [20550, 83550, 178150, 340100, 431900, 647850], hoh: [14650, 55900, 89050, 170050, 215950, 539900], mfs: [10275, 41775, 89075, 170050, 215950, 323925] },
    cg: { single: [41675, 459750], mfj: [83350, 517200], hoh: [55800, 488500], mfs: [41675, 258600] },
    ssBase: 147000, ctc: 2000, actc: 1500, salt: [10000, 0], ira: 6000, sli: [70000, 85000, 145000, 175000], qbi: [170050, 340100],
    eitc: { max: [560, 3733, 6164, 6935], ei: [7320, 10980, 15410, 15410], po: [9160, 20130, 20130, 20130], poJ: [15290, 26260, 26260, 26260], inv: 10300 } },
  2023: { sd: { single: 13850, mfj: 27700, mfs: 13850, hoh: 20800, qss: 27700 }, add: [1500, 1850], depSD: [1250, 400],
    br: { single: [11000, 44725, 95375, 182100, 231250, 578125], mfj: [22000, 89450, 190750, 364200, 462500, 693750], hoh: [15700, 59850, 95350, 182100, 231250, 578100], mfs: [11000, 44725, 95375, 182100, 231250, 346875] },
    cg: { single: [44625, 492300], mfj: [89250, 553850], hoh: [59750, 523050], mfs: [44625, 276900] },
    ssBase: 160200, ctc: 2000, actc: 1600, salt: [10000, 0], ira: 6500, sli: [75000, 90000, 155000, 185000], qbi: [182100, 364200],
    eitc: { max: [600, 3995, 6604, 7430], ei: [7840, 11750, 16510, 16510], po: [9800, 21560, 21560, 21560], poJ: [16370, 28120, 28120, 28120], inv: 11000 } },
  2024: { sd: { single: 14600, mfj: 29200, mfs: 14600, hoh: 21900, qss: 29200 }, add: [1550, 1950], depSD: [1300, 450],
    br: { single: [11600, 47150, 100525, 191950, 243725, 609350], mfj: [23200, 94300, 201050, 383900, 487450, 731200], hoh: [16550, 63100, 100500, 191950, 243700, 609350], mfs: [11600, 47150, 100525, 191950, 243725, 365600] },
    cg: { single: [47025, 518900], mfj: [94050, 583750], hoh: [63000, 551350], mfs: [47025, 291850] },
    ssBase: 168600, ctc: 2000, actc: 1700, salt: [10000, 0], ira: 7000, sli: [80000, 95000, 165000, 195000], qbi: [191950, 383900],
    eitc: { max: [632, 4213, 6960, 7830], ei: [8260, 12390, 17400, 17400], po: [10330, 22720, 22720, 22720], poJ: [17250, 29640, 29640, 29640], inv: 11600 } },
  2025: { sd: { single: 15750, mfj: 31500, mfs: 15750, hoh: 23625, qss: 31500 }, add: [1600, 2000], depSD: [1350, 450],
    br: { single: [11925, 48475, 103350, 197300, 250525, 626350], mfj: [23850, 96950, 206700, 394600, 501050, 751600], hoh: [17000, 64850, 103350, 197300, 250500, 626350], mfs: [11925, 48475, 103350, 197300, 250525, 375800] },
    cg: { single: [48350, 533400], mfj: [96700, 600050], hoh: [64750, 566700], mfs: [48350, 300000] },
    ssBase: 176100, ctc: 2200, actc: 1700, salt: [40000, 500000], ira: 7000, sli: [85000, 100000, 170000, 200000], qbi: [197300, 394600], obbb: true,
    eitc: { max: [649, 4328, 7152, 8046], ei: [8490, 12730, 17880, 17880], po: [10620, 23350, 23350, 23350], poJ: [17730, 30470, 30470, 30470], inv: 11950 } },
  2026: { sd: { single: 16100, mfj: 32200, mfs: 16100, hoh: 24150, qss: 32200 }, add: [1650, 2050], depSD: [1350, 450],
    br: { single: [12400, 50400, 105700, 201775, 256225, 640600], mfj: [24800, 100800, 211400, 403550, 512450, 768700], hoh: [17700, 67450, 105700, 201750, 256200, 640600], mfs: [12400, 50400, 105700, 201775, 256225, 384350] },
    cg: { single: [49450, 545500], mfj: [98900, 613700], hoh: [66200, 579600], mfs: [49450, 306850] },
    ssBase: 184500, ctc: 2200, actc: 1700, salt: [40400, 505000], ira: 7500, sli: [85000, 100000, 175000, 205000], qbi: [201750, 403500], obbb: true,
    eitc: { max: [664, 4427, 7316, 8231], ei: [8680, 13020, 18290, 18290], po: [10860, 23890, 23890, 23890], poJ: [18140, 31160, 31160, 31160], inv: 12200 } },
};

// Key filing dates (individual due date; business pass-through due date)
const DUE = { 2021: ['2022-04-18', '2022-03-15', '2022-04-18'], 2022: ['2023-04-18', '2023-03-15', '2023-04-18'], 2023: ['2024-04-15', '2024-03-15', '2024-04-15'],
  2024: ['2025-04-15', '2025-03-17', '2025-04-15'], 2025: ['2026-04-15', '2026-03-16', '2026-04-15'], 2026: ['2027-04-15', '2027-03-15', '2027-04-15'] };

const N = v => { const x = parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return isFinite(x) ? x : 0; };
const sum = (a, f) => (a || []).reduce((s, x) => s + N(f(x)), 0);
const clamp01 = x => Math.max(0, Math.min(1, x));
const ov = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
const r2 = x => Math.round(x * 100) / 100;

function brTax(x, th) { let t = 0, prev = 0; for (let i = 0; i < 7; i++) { const top = i < 6 ? th[i] : Infinity; if (x > prev) t += (Math.min(x, top) - prev) * RATES[i]; prev = top; } return t; }
// IRS Tax Table emulation for taxable income under $100,000 (tax on the midpoint of the row)
function brTaxT(x, th) {
  if (x <= 0) return 0;
  if (x >= 100000) return brTax(x, th);
  let mid; if (x < 5) mid = 2.5; else if (x < 15) mid = 10; else if (x < 25) mid = 20; else if (x < 3000) mid = Math.floor(x / 25) * 25 + 12.5; else mid = Math.floor(x / 50) * 50 + 25;
  return Math.round(brTax(mid, th));
}
function prog(x, th, rates) { let t = 0, prev = 0; for (let i = 0; i < rates.length; i++) { const top = i < th.length ? th[i] : Infinity; if (x > prev) t += (Math.min(x, top) - prev) * rates[i] / 100; prev = top; } return t; }

function yearsOld(dob, y) { if (!dob) return null; const b = new Date(dob + 'T00:00:00'); if (isNaN(b)) return null; return y - b.getFullYear() - ((b.getMonth() > 11 || (b.getMonth() === 11 && b.getDate() > 31)) ? 1 : 0); }
// age at Dec 31 of year y
function ageEOY(dob, y) { if (!dob) return null; const b = new Date(dob + 'T00:00:00'); if (isNaN(b)) return null; return y - b.getFullYear(); }
// IRS: you're 65 if born before Jan 2 of (y-64)
function is65(dob, y) { if (!dob) return false; const b = new Date(dob + 'T00:00:00'); return !isNaN(b) && b < new Date(y - 64, 0, 2); }

function schCNet(b) {
  const e = b.exp || {};
  const exp = ['adv', 'car', 'contract', 'ins', 'legal', 'office', 'rent', 'repair', 'supplies', 'taxes', 'travel', 'util', 'wages', 'depr', 'other'].reduce((s, k) => s + N(e[k]), 0) + 0.5 * N(e.meals);
  const receipts = N(b.gross) + N(b._nec) - N(b.returns);
  const gp = receipts - N(b.cogs);
  const tent = gp - exp;
  const home = Math.min(Math.min(N(b.homeSqft), 300) * 5, Math.max(0, tent));
  return { receipts, gp, exp, home, net: tent - home };
}

function emptyIndividual() {
  return { fs: 'single', tp: { first: '', last: '', ssn: '', dob: '', blind: false, dependentOfOther: false }, sp: { first: '', last: '', ssn: '', dob: '', blind: false },
    addr: { street: '', city: '', st: 'PA', zip: '' }, resState: 'PA', deps: [], w2: [], int: [], div: [], nec: [], r: [], cg: { st: '', lt: '', carry: '' },
    g: { unemp: '', stRefund: '', fedWH: '' }, ssa: { benefits: '', fedWH: '' }, rental: { net: '' }, otherInc: '', biz: [],
    adj: { hsa: '', ira: '', sli: '', educator: '', sehi: '', sep: '' }, item: { medical: '', salt: '', realEstate: '', mortgage: '', charityCash: '', charityNon: '', other: '', force: false },
    obb: { tips: '', overtime: '', carInt: '' }, cr: { careExp: '', careKids: '', students: [], advCTC: '', rrc: '' },
    pay: { est: '', prior: '', ext: '' }, st: { md: { rate: '3.20', sub: '', est: '' }, pa: { est: '', eit: '' }, nj: { propTax: '', rent: '', est: '' }, other: { rate: '', ded: '', est: '' } } };
}
function emptyBusiness() {
  return { entity: 'scorp', name: '', ein: '', st: 'PA', gross: '', returns: '', cogs: '', otherInc: '',
    ded: { officer: '', salaries: '', guaranteed: '', repairs: '', badDebt: '', rent: '', taxes: '', interest: '', depr: '', adv: '', pension: '', benefits: '', other: '' },
    owners: [{ name: '', pct: '100', comp: '' }], pay: { est: '', stEst: '' } };
}

/* ───────── Federal individual ───────── */
function fed(ret) {
  const d = ret.data, y = +ret.year, p = P[y], fs = d.fs, bk = fs === 'qss' ? 'mfj' : fs;
  const joint = fs === 'mfj' || fs === 'qss';
  const L = {};
  // assign 1099-NEC to businesses
  (d.biz || []).forEach(b => b._nec = 0);
  (d.nec || []).forEach(n => { const b = (d.biz || [])[+n.biz || 0]; if (b) b._nec += N(n.amt); });
  L.wages = sum(d.w2, w => w.b1);
  L.taxInt = sum(d.int, i => i.amt); L.exInt = sum(d.int, i => i.taxExempt);
  L.ordDiv = sum(d.div, x => x.ord); L.qualDiv = Math.min(sum(d.div, x => x.qual), L.ordDiv); L.capDist = sum(d.div, x => x.capdist);
  const st = N(d.cg.st) - N(d.cg.carry), lt = N(d.cg.lt) + L.capDist;
  L.capNet = st + lt;
  const lossLim = fs === 'mfs' ? -1500 : -3000;
  L.capInc = L.capNet < 0 ? Math.max(L.capNet, lossLim) : L.capNet;
  L.capCarryOut = L.capNet < lossLim ? lossLim - L.capNet : 0;
  L.netLT = Math.max(0, Math.min(lt, L.capNet));
  L.iraGross = sum((d.r || []).filter(x => x.ira), x => x.gross); L.iraTax = sum((d.r || []).filter(x => x.ira), x => x.taxable);
  L.penGross = sum((d.r || []).filter(x => !x.ira), x => x.gross); L.penTax = sum((d.r || []).filter(x => !x.ira), x => x.taxable);
  L.earlyDist = sum((d.r || []).filter(x => String(x.code || '').trim().startsWith('1')), x => x.taxable);
  L.biz = (d.biz || []).map(schCNet);
  L.schC = L.biz.reduce((s, b) => s + b.net, 0);
  L.unemp = N(d.g.unemp); L.stRefund = N(d.g.stRefund); L.rental = N(d.rental.net); L.other = N(d.otherInc);
  L.ssBen = N(d.ssa.benefits);
  // Self-employment tax (Schedule SE)
  const seBase = L.schC * 0.9235;
  L.netSE = seBase >= 400 ? seBase : 0;
  const ssW = sum(d.w2, w => w.b3);
  L.seTax = 0.124 * Math.max(0, Math.min(L.netSE, p.ssBase - ssW)) + 0.029 * L.netSE;
  L.halfSE = L.seTax / 2;
  L.addInc = L.capInc * 0 + L.schC + L.unemp + L.stRefund + L.rental + L.other; // Schedule 1 additional income
  const incExSS = L.wages + L.taxInt + L.ordDiv + L.capInc + L.iraTax + L.penTax + L.addInc;
  const a = d.adj;
  L.adjHSA = N(a.hsa); L.adjIRA = N(a.ira); L.adjEdu = Math.min(N(a.educator), joint ? 600 : 300); L.adjSEHI = N(a.sehi); L.adjSEP = N(a.sep);
  const adjPre = L.halfSE + L.adjHSA + L.adjIRA + L.adjEdu + L.adjSEHI + L.adjSEP;
  // Taxable Social Security
  const b1 = joint ? 32000 : fs === 'mfs' ? 0 : 25000, b2 = joint ? 44000 : fs === 'mfs' ? 0 : 34000;
  const prov = incExSS - adjPre + L.exInt + 0.5 * L.ssBen;
  let ssT = 0;
  if (L.ssBen > 0) {
    if (prov <= b1) ssT = 0; else if (prov <= b2) ssT = Math.min(0.5 * L.ssBen, 0.5 * (prov - b1));
    else ssT = Math.min(0.85 * L.ssBen, 0.85 * (prov - b2) + Math.min(0.5 * L.ssBen, 0.5 * (b2 - b1)));
  }
  L.ssTax = Math.max(0, ssT);
  L.totalInc = incExSS + L.ssTax;
  // Student loan interest with phaseout
  const magiS = L.totalInc - adjPre;
  const [lo, hi] = joint ? [p.sli[2], p.sli[3]] : [p.sli[0], p.sli[1]];
  L.adjSLI = fs === 'mfs' ? 0 : Math.min(N(a.sli), 2500) * (1 - clamp01((magiS - lo) / (hi - lo)));
  L.adj = adjPre + L.adjSLI;
  L.agi = L.totalInc - L.adj;
  // Standard deduction
  const tp65 = is65(d.tp.dob, y), sp65 = joint && is65(d.sp.dob, y);
  const addlCount = (tp65 ? 1 : 0) + (d.tp.blind ? 1 : 0) + (fs === 'mfj' ? (sp65 ? 1 : 0) + (d.sp.blind ? 1 : 0) : 0);
  let sd = p.sd[fs];
  if (d.tp.dependentOfOther) sd = Math.min(sd, Math.max(p.depSD[0], L.wages + Math.max(0, L.schC - L.halfSE) + p.depSD[1]));
  sd += addlCount * ((fs === 'single' || fs === 'hoh') ? p.add[1] : p.add[0]);
  L.sd = sd;
  // Itemized (Schedule A)
  const it = d.item;
  L.medDed = Math.max(0, N(it.medical) - 0.075 * L.agi);
  let saltCap = p.salt[0] / (fs === 'mfs' ? 2 : 1);
  if (p.salt[1]) { const th = p.salt[1] / (fs === 'mfs' ? 2 : 1); saltCap = Math.max(10000 / (fs === 'mfs' ? 2 : 1), saltCap - 0.3 * Math.max(0, L.agi - th)); }
  L.saltCap = saltCap; L.saltRaw = N(it.salt) + N(it.realEstate);
  L.saltDed = Math.min(L.saltRaw, saltCap);
  let charity = N(it.charityCash) + N(it.charityNon);
  if (y >= 2026) charity = Math.max(0, charity - 0.005 * L.agi);
  L.itemTotal = L.medDed + L.saltDed + N(it.mortgage) + charity + N(it.other);
  L.itemized = it.force || L.itemTotal > sd;
  L.ded = L.itemized ? L.itemTotal : sd;
  // Non-itemizer charitable deduction (2021: $300/$600, 2026+: $1,000/$2,000)
  L.nonItemCharity = 0;
  if (!L.itemized && (y === 2021 || y >= 2026)) L.nonItemCharity = Math.min(N(it.charityCash), y === 2021 ? (fs === 'mfj' ? 600 : 300) : (joint ? 2000 : 1000));
  // OBBBA deductions (Schedule 1-A), 2025-2028
  const o = d.obb; L.tips = L.ot = L.carInt = L.senior = 0;
  if (p.obbb && fs !== 'mfs') {
    const ex1 = Math.max(0, L.agi - (fs === 'mfj' ? 300000 : 150000));
    L.tips = Math.max(0, Math.min(N(o.tips), 25000) - 0.1 * ex1);
    L.ot = Math.max(0, Math.min(N(o.overtime), fs === 'mfj' ? 25000 : 12500) - 0.1 * ex1);
    const n65 = (tp65 ? 1 : 0) + (fs === 'mfj' && sp65 ? 1 : 0);
    L.senior = Math.max(0, 6000 * n65 - 0.06 * Math.max(0, L.agi - (fs === 'mfj' ? 150000 : 75000)));
  }
  if (p.obbb) { const ex2 = Math.max(0, L.agi - (fs === 'mfj' ? 200000 : 100000)); L.carInt = Math.max(0, Math.min(N(o.carInt), 10000) - 0.2 * ex2); }
  L.sch1A = L.tips + L.ot + L.carInt + L.senior;
  const tiPre = Math.max(0, L.agi - L.ded - L.nonItemCharity - L.sch1A);
  // QBI (Form 8995, simplified)
  const qbiBase = Math.max(0, L.schC - L.halfSE - L.adjSEHI - L.adjSEP);
  L.qbi = Math.max(0, Math.min(0.2 * qbiBase, 0.2 * Math.max(0, tiPre - (L.qualDiv + L.netLT))));
  if (y >= 2026 && qbiBase >= 1000) L.qbi = Math.min(Math.max(L.qbi, 400), tiPre);
  L.qbiOverThreshold = tiPre > p.qbi[joint ? 1 : 0] && qbiBase > 0;
  L.ti = Math.max(0, tiPre - L.qbi);
  // Tax (Qualified Dividends & Capital Gain worksheet)
  const br = p.br[bk], cg = p.cg[bk];
  const qInc = Math.min(L.ti, L.qualDiv + L.netLT), ord = L.ti - qInc;
  L.prefInc = qInc;
  let tax = brTaxT(ord, br) + 0.15 * ov(ord, L.ti, cg[0], cg[1]) + 0.20 * ov(ord, L.ti, cg[1], Infinity);
  L.tax = Math.round(Math.min(tax, brTaxT(L.ti, br)));
  L.marginal = RATES[br.findIndex(t => L.ti <= t) === -1 ? 6 : br.findIndex(t => L.ti <= t)];
  // Credits
  const earned = L.wages + Math.max(0, L.schC - L.halfSE);
  L.earned = earned;
  const deps = d.deps || [];
  const kidAge = y === 2021 ? 18 : 17;
  const qKids = deps.filter(x => { const ag = ageEOY(x.dob, y); return ag !== null && ag < kidAge && ['son', 'daughter', 'child', 'stepchild', 'foster', 'sibling', 'grandchild'].includes((x.rel || '').toLowerCase()); });
  L.ctcKids = qKids.length; L.odcDeps = deps.length - qKids.length;
  // child care
  const careKids = N(d.cr.careKids);
  L.care = 0; L.careRefundable = 0;
  if (careKids > 0 && fs !== 'mfs') {
    if (y === 2021) {
      const exp = Math.min(N(d.cr.careExp), careKids >= 2 ? 16000 : 8000, earned);
      let rate = Math.max(0.20, 0.50 - 0.01 * Math.ceil(Math.max(0, L.agi - 125000) / 2000));
      if (L.agi > 400000) rate = Math.max(0, 0.20 - 0.01 * Math.ceil((L.agi - 400000) / 2000));
      L.careRefundable = exp * rate;
    } else {
      const exp = Math.min(N(d.cr.careExp), careKids >= 2 ? 6000 : 3000, earned);
      let rate;
      if (y >= 2026) {
        rate = Math.max(0.35, 0.50 - 0.01 * Math.ceil(Math.max(0, L.agi - 15000) / 2000));
        const hiT = fs === 'mfj' ? 150000 : 75000, step = fs === 'mfj' ? 4000 : 2000;
        if (L.agi > hiT) rate = Math.max(0.20, rate - 0.01 * Math.ceil((L.agi - hiT) / step));
      } else rate = Math.max(0.20, 0.35 - 0.01 * Math.ceil(Math.max(0, L.agi - 15000) / 2000));
      L.care = exp * rate;
    }
  }
  // education
  const f = fs === 'mfs' ? 1 : clamp01((L.agi - (joint ? 160000 : 80000)) / (joint ? 20000 : 10000));
  let aotc = 0, llcExp = 0;
  (d.cr.students || []).forEach(s => { const e = N(s.exp); if (s.type === 'llc') llcExp += e; else aotc += Math.min(e, 2000) + 0.25 * Math.min(Math.max(e - 2000, 0), 2000); });
  aotc *= (1 - f); const llc = 0.2 * Math.min(llcExp, 10000) * (1 - f);
  L.aotcRef = 0.4 * aotc; L.eduNonref = 0.6 * aotc + llc;
  // CTC / ODC
  let ctcMax, ctcRef2021 = 0;
  if (y === 2021) {
    const thr1 = joint ? 150000 : fs === 'hoh' ? 112500 : 75000;
    let extra = qKids.reduce((s, k) => s + (ageEOY(k.dob, y) < 6 ? 1600 : 1000), 0);
    extra = Math.max(0, extra - 50 * Math.ceil(Math.max(0, L.agi - thr1) / 1000));
    const red2 = 50 * Math.ceil(Math.max(0, L.agi - (fs === 'mfj' ? 400000 : 200000)) / 1000);
    const kidBase = Math.max(0, qKids.length * 2000 - red2);
    ctcMax = Math.max(0, L.odcDeps * 500 - Math.max(0, red2 - qKids.length * 2000));
    ctcRef2021 = extra + kidBase;
  } else {
    ctcMax = Math.max(0, qKids.length * p.ctc + L.odcDeps * 500 - 50 * Math.ceil(Math.max(0, L.agi - (fs === 'mfj' ? 400000 : 200000)) / 1000));
  }
  let remaining = L.tax;
  const use = c => { const u = Math.min(c, remaining); remaining -= u; return u; };
  L.careUsed = use(L.care); L.eduUsed = use(L.eduNonref); L.ctcUsed = use(ctcMax);
  L.nonref = L.careUsed + L.eduUsed + L.ctcUsed;
  const unusedKid = Math.min(ctcMax - L.ctcUsed, Math.max(0, ctcMax - L.odcDeps * 500));
  L.actc = y === 2021 ? 0 : Math.max(0, Math.min(unusedKid, qKids.length * p.actc, 0.15 * Math.max(0, earned - 2500)));
  L.ctc2021Ref = y === 2021 ? Math.max(0, ctcRef2021 - N(d.cr.advCTC)) : 0;
  L.advCTCExcess = y === 2021 ? Math.max(0, N(d.cr.advCTC) - ctcRef2021) : 0;
  // EITC
  const ep = p.eitc;
  const eKids = Math.min(3, deps.filter(x => { const ag = ageEOY(x.dob, y); return ag !== null && (ag < 19 || (x.student && ag < 24)); }).length);
  const inv = L.taxInt + L.exInt + L.ordDiv + Math.max(0, L.capNet) + Math.max(0, L.rental);
  L.eitc = 0; L.eitcNote = '';
  const tpAge = ageEOY(d.tp.dob, y);
  const ageOk = eKids > 0 || (tpAge !== null && (y === 2021 ? tpAge >= 19 : tpAge >= 25 && tpAge < 65));
  if (fs !== 'mfs' && inv <= ep.inv && earned > 0 && ageOk && !d.tp.dependentOfOther) {
    const inR = [ep.inRate0 || .0765, .34, .40, .45][eKids], outR = [ep.outRate0 || .0765, .1598, .2106, .2106][eKids];
    const base = Math.min(inR * earned, ep.max[eKids]);
    const po = joint ? ep.poJ[eKids] : ep.po[eKids];
    L.eitc = Math.max(0, Math.round(base - outR * Math.max(0, Math.max(L.agi, earned) - po)));
  }
  L.eitcKids = eKids;
  // Other taxes (Schedule 2)
  const medW = sum(d.w2, w => w.b5);
  const amThr = joint ? 250000 : fs === 'mfs' ? 125000 : 200000;
  L.addlMed = 0.009 * Math.max(0, medW + L.netSE - amThr);
  const nii = L.taxInt + L.ordDiv + Math.max(0, L.capInc) + Math.max(0, L.rental);
  L.niit = 0.038 * Math.min(nii, Math.max(0, L.agi - amThr));
  L.earlyPen = 0.10 * L.earlyDist;
  L.otherTaxes = L.seTax + L.addlMed + L.niit + L.earlyPen + L.advCTCExcess;
  L.totalTax = Math.max(0, L.tax - L.nonref) + L.otherTaxes;
  // Payments
  L.wh = sum(d.w2, w => w.b2) + sum(d.int, x => x.fedWH) + sum(d.div, x => x.fedWH) + sum(d.nec, x => x.fedWH) + N(d.g.fedWH) + sum(d.r, x => x.fedWH) + N(d.ssa.fedWH);
  L.addlMedWH = (d.w2 || []).reduce((s, w) => s + Math.max(0, N(w.b6) - 0.0145 * N(w.b5)), 0);
  L.est = N(d.pay.est) + N(d.pay.prior) + N(d.pay.ext);
  L.rrc = y === 2021 ? N(d.cr.rrc) : 0;
  L.refundable = L.actc + L.aotcRef + L.eitc + L.careRefundable + L.ctc2021Ref + L.rrc;
  L.totalPay = L.wh + L.addlMedWH + L.est + L.refundable;
  L.balance = r2(L.totalPay - L.totalTax); // + refund, - owed
  L.effRate = L.agi > 0 ? L.totalTax / L.agi : 0;
  return L;
}

/* ───────── States ───────── */
function stWH(d, code) { return (d.w2 || []).filter(w => (w.st || '').toUpperCase() === code).reduce((s, w) => s + N(w.b17) + N(w.b19), 0); }
function stWages(d, code) { return sum(d.w2, w => ((w.st || '').toUpperCase() === code && N(w.b16)) ? w.b16 : w.b1); }

function statePA(ret, F) {
  const d = ret.data, y = +ret.year;
  const comp = stWages(d, 'PA'), interest = F.taxInt, div = F.ordDiv, biz = Math.max(0, F.schC), gains = Math.max(0, F.capNet), rents = Math.max(0, F.rental);
  const total = comp + interest + div + biz + gains + rents;
  const schO = N(d.adj.hsa);
  const ti = Math.max(0, total - schO);
  const tax = ti * 0.0307;
  const married = d.fs === 'mfj' || d.fs === 'mfs';
  const elig = ti + F.penTax + F.iraTax + F.unemp + F.exInt + F.ssBen * 0;
  const base = (married ? 13000 : 6500) + 9500 * (d.deps || []).length;
  const pct = elig <= base ? 100 : Math.max(0, 100 - 10 * Math.ceil((elig - base) / 250));
  const forgiven = tax * pct / 100;
  const wh = stWH(d, 'PA'), est = N(d.st.pa.est);
  const liab = tax - forgiven;
  const eitRate = N(d.st.pa.eit);
  return { code: 'PA', form: 'PA-40', amendForm: 'PA-40 marked "Amended" + Schedule PA-40 X', tax: liab, wh: wh + est, bal: r2(wh + est - liab),
    lines: [['1a Gross compensation', comp], ['2 Interest', interest], ['3 Dividends & capital gain distributions', div], ['4 Net income from business', biz], ['5 Net gains from property', gains], ['6 Net rents & royalties', rents],
      ['9 Total PA taxable income', total], ['10 Other deductions (Sch O — HSA)', schO], ['11 Adjusted PA taxable income', ti], ['12 PA tax (3.07%)', tax],
      ['Sch SP eligibility income', elig], ['Tax forgiveness %', pct + '%'], ['21 Tax forgiveness credit', forgiven], ['13 PA tax withheld', wh], ['14 Estimated payments', est]],
    extra: eitRate ? [`Local Earned Income Tax (filed separately with your local collector, e.g. Berkheimer/Keystone): ≈ $${fmt((comp + biz) * eitRate / 100)} at ${eitRate}%`] : [] };
}

function stateMD(ret, F) {
  const d = ret.data, y = +ret.year, fs = d.fs;
  const joint = fs === 'mfj' || fs === 'hoh' || fs === 'qss';
  const mdagi = F.agi - F.ssTax - N(d.st.md.sub);
  let std;
  if (y >= 2025) std = joint ? 6700 : 3350;
  else { const t = { 2021: [1600, 2400, 3200, 4850], 2022: [1700, 2550, 3450, 5150], 2023: [1800, 2700, 3650, 5450], 2024: [1800, 2700, 3650, 5450] }[y]; std = Math.min(Math.max(0.15 * mdagi, joint ? t[2] : t[0]), joint ? t[3] : t[1]); }
  let itemized = 0;
  if (F.itemized) { itemized = F.itemTotal - Math.min(F.saltDed, N(d.item.salt)); if (y >= 2025) itemized = Math.max(0, itemized - 0.075 * Math.max(0, F.agi - (fs === 'mfs' ? 100000 : 200000))); }
  const ded = Math.max(std, itemized);
  const people = 1 + (fs === 'mfj' ? 1 : 0) + (d.deps || []).length;
  const fagi = F.agi;
  const per = joint ? (fagi <= 150000 ? 3200 : fagi <= 175000 ? 1600 : fagi <= 200000 ? 800 : 0) : (fagi <= 100000 ? 3200 : fagi <= 125000 ? 1600 : fagi <= 150000 ? 800 : 0);
  const extra = 1000 * ((is65(d.tp.dob, y) ? 1 : 0) + (d.tp.blind ? 1 : 0) + (fs === 'mfj' ? (is65(d.sp.dob, y) ? 1 : 0) + (d.sp.blind ? 1 : 0) : 0));
  const ex = people * per + extra;
  const ti = Math.max(0, mdagi - ded - ex);
  const th = joint ? [1000, 2000, 3000, 150000, 175000, 225000, 300000] : [1000, 2000, 3000, 100000, 125000, 150000, 250000];
  const rates = [2, 3, 4, 4.75, 5, 5.25, 5.5, 5.75];
  if (y >= 2025) { th.push(...(joint ? [600000, 1200000] : [500000, 1000000])); rates.push(6.25, 6.5); }
  const stTax = prog(ti, th, rates);
  const rate = N(d.st.md.rate);
  const local = ti * rate / 100;
  const sur = y >= 2025 && fagi > 350000 ? 0.02 * Math.max(0, F.capNet) : 0;
  const tax = stTax + local + sur;
  const wh = stWH(d, 'MD'), est = N(d.st.md.est);
  return { code: 'MD', form: 'Form 502', amendForm: 'Form 502X', tax, wh: wh + est, bal: r2(wh + est - tax),
    lines: [['1 Federal AGI', fagi], ['Subtractions (taxable Social Security + other)', F.ssTax + N(d.st.md.sub)], ['16 Maryland AGI', mdagi], [F.itemized && itemized > std ? '17 Itemized deductions' : '17 Standard deduction', ded],
      ['19 Exemptions', ex], ['20 Maryland taxable income', ti], ['21 Maryland tax', stTax], [`28 Local tax (${rate || 0}%)`, local], ...(sur ? [['Capital gains surcharge (2%)', sur]] : []),
      ['34 Total MD + local tax', tax], ['40 MD tax withheld (state + local)', wh], ['39 Estimated payments', est]],
    extra: y < 2025 ? ['MD standard deduction min/max for 2021–2024 is approximated from the 15%-of-AGI formula — confirm against the year\'s Form 502 instructions.'] : [] };
}

function stateNJ(ret, F) {
  const d = ret.data, y = +ret.year, fs = d.fs;
  const joint = fs === 'mfj' || fs === 'hoh' || fs === 'qss';
  const wages = stWages(d, 'NJ');
  const gross = wages + F.taxInt + (F.ordDiv - 0) + Math.max(0, F.schC) + Math.max(0, F.capNet) + F.penTax + F.iraTax + Math.max(0, F.rental) + F.other;
  const below = gross <= (joint || fs === 'mfj' ? 20000 : 10000);
  const n65 = (is65(d.tp.dob, y) ? 1 : 0) + (d.tp.blind ? 1 : 0) + (fs === 'mfj' ? (is65(d.sp.dob, y) ? 1 : 0) + (d.sp.blind ? 1 : 0) : 0);
  const ex = 1000 + (fs === 'mfj' ? 1000 : 0) + 1500 * (d.deps || []).length + 1000 * n65;
  const propDed = Math.min(N(d.st.nj.propTax) + 0.18 * N(d.st.nj.rent), fs === 'mfs' ? 7500 : 15000);
  const th = joint ? [20000, 50000, 70000, 80000, 150000, 500000, 1000000] : [20000, 35000, 40000, 75000, 500000, 1000000];
  const rates = joint ? [1.4, 1.75, 2.45, 3.5, 5.525, 6.37, 8.97, 10.75] : [1.4, 1.75, 3.5, 5.525, 6.37, 8.97, 10.75];
  const tiA = Math.max(0, gross - ex - propDed), tiB = Math.max(0, gross - ex);
  const taxA = prog(tiA, th, rates), taxB = Math.max(0, prog(tiB, th, rates) - (propDed > 0 ? 50 : 0));
  const useDed = taxA <= taxB;
  const tax = below ? 0 : Math.min(taxA, taxB);
  const wh = stWH(d, 'NJ'), est = N(d.st.nj.est);
  return { code: 'NJ', form: 'NJ-1040', amendForm: 'NJ-1040X', tax, wh: wh + est, bal: r2(wh + est - tax),
    lines: [['15 Wages', wages], ['16a Taxable interest', F.taxInt], ['17 Dividends', F.ordDiv], ['18 Net profits from business', Math.max(0, F.schC)], ['19 Net gains', Math.max(0, F.capNet)],
      ['20a Pensions/annuities/IRA (before exclusion)', F.penTax + F.iraTax], ['27 Total income', gross], ['30 Exemptions', ex], [useDed ? '41 Property tax deduction' : 'Property tax credit ($50) used instead', useDed ? propDed : 50],
      ['42 NJ taxable income', useDed ? tiA : tiB], ['43 NJ tax', tax], ['55 NJ tax withheld', wh], ['56 Estimated payments', est]],
    extra: below ? ['Gross income is at or below the NJ filing threshold — no NJ tax due; file only to claim a refund of withholding.'] : [] };
}

function stateOther(ret, F) {
  const d = ret.data, rate = N(d.st.other.rate), ti = Math.max(0, F.agi - N(d.st.other.ded)), tax = ti * rate / 100;
  const code = (d.resState || '').toUpperCase();
  const wh = stWH(d, code), est = N(d.st.other.est);
  return { code, form: code + ' resident return (estimate)', amendForm: code + ' amended return', tax, wh: wh + est, bal: r2(wh + est - tax), estimate: true,
    lines: [['Federal AGI', F.agi], ['State deduction / exemptions (entered)', N(d.st.other.ded)], ['Taxable (estimate)', ti], [`Tax at ${rate}% (flat estimate)`, tax], ['State withheld', wh], ['Estimated payments', est]],
    extra: ['Rough flat-rate estimate only. Detailed calculations are built in for PA, MD and NJ.'] };
}
const NOTAX = ['FL', 'TX', 'NV', 'WA', 'WY', 'SD', 'AK', 'TN', 'NH'];
function stateCalc(ret, F) {
  const s = (ret.data.resState || '').toUpperCase();
  if (s === 'PA') return statePA(ret, F); if (s === 'MD') return stateMD(ret, F); if (s === 'NJ') return stateNJ(ret, F);
  if (!s || NOTAX.includes(s)) return { code: s, form: 'No state income tax return', tax: 0, wh: 0, bal: 0, lines: [], extra: [s ? `${s} has no broad state income tax on wages.` : 'No resident state selected.'], none: true };
  return stateOther(ret, F);
}

/* ───────── Business entities ───────── */
const PA_CNIT = { 2021: 9.99, 2022: 9.99, 2023: 8.99, 2024: 8.49, 2025: 7.99, 2026: 7.49 };
function bizCalc(ret) {
  const d = ret.data, y = +ret.year, e = d.entity;
  const L = {};
  L.receipts = N(d.gross) - N(d.returns); L.gp = L.receipts - N(d.cogs); L.income = L.gp + N(d.otherInc);
  L.deductions = Object.values(d.ded || {}).reduce((s, v) => s + N(v), 0);
  L.obi = L.income - L.deductions;
  L.k1 = (d.owners || []).map(o => ({ name: o.name || 'Owner', pct: N(o.pct), share: L.obi * N(o.pct) / 100 }));
  L.fedTax = e === 'ccorp' ? Math.max(0, L.obi) * 0.21 : 0;
  L.fedPay = N(d.pay.est);
  L.fedBal = r2(L.fedPay - L.fedTax);
  // state entity-level tax
  const s = (d.st || '').toUpperCase(); let stTax = 0, stForm = '', stNote = '';
  if (s === 'PA') {
    if (e === 'ccorp') { stTax = Math.max(0, L.obi) * PA_CNIT[y] / 100; stForm = 'RCT-101 (Corporate Net Income Tax ' + PA_CNIT[y] + '%)'; }
    else { stForm = e === 'scorp' ? 'PA-20S/PA-65 information return' : 'PA-20S/PA-65 information return'; stNote = 'No entity-level PA income tax; owners report their share on PA-40 (Schedule RK-1/NRK-1).'; }
  } else if (s === 'NJ') {
    const gr = L.receipts;
    if (e === 'ccorp') {
      const ti = Math.max(0, L.obi); let rate = ti <= 50000 ? 6.5 : ti <= 100000 ? 7.5 : 9; if (ti > 1000000) rate = 9; let t = ti * rate / 100;
      if (ti > 10000000 && y >= 2024 && y <= 2028) t += ti * 0.025;
      const min = gr < 100000 ? 500 : gr < 250000 ? 750 : gr < 500000 ? 1000 : gr < 1000000 ? 1500 : 2000;
      stTax = Math.max(t, min); stForm = 'CBT-100';
    } else if (e === 'scorp') { stTax = gr < 100000 ? 375 : gr < 250000 ? 562.5 : gr < 500000 ? 750 : gr < 1000000 ? 1125 : 1500; stForm = 'CBT-100S (minimum tax)'; }
    else { const n = (d.owners || []).length; stTax = n > 2 ? Math.min(150 * n, 250000) : 0; stForm = 'NJ-1065 (partnership filing fee)'; }
  } else if (s === 'MD') {
    if (e === 'ccorp') { stTax = Math.max(0, L.obi) * 0.0825; stForm = 'Form 500 (8.25%)'; }
    else { stForm = 'Form 510/511 pass-through return'; stNote = 'MD may require tax on nonresident members\' shares; resident owners report on Form 502.'; }
  } else { stForm = s ? s + ' business return' : 'State business return'; stNote = 'Entity-level state tax only calculated for PA, NJ and MD.'; }
  L.stTax = stTax; L.stForm = stForm; L.stNote = stNote; L.stPay = N(d.pay.stEst); L.stBal = r2(L.stPay - stTax);
  L.form = { scorp: 'Form 1120-S', partnership: 'Form 1065', ccorp: 'Form 1120' }[e];
  L.amendForm = { scorp: 'Form 1120-S with "Amended return" box checked + corrected K-1s', partnership: 'Form 1065-X or Administrative Adjustment Request (BBA partnerships)', ccorp: 'Form 1120-X' }[e];
  return L;
}

/* ───────── Deadlines & e-file windows ───────── */
function deadlines(year, kind, entity, today) {
  today = today || new Date();
  const dd = DUE[year]; if (!dd) return {};
  const due = new Date((kind === 'business' ? (entity === 'ccorp' ? dd[2] : dd[1]) : dd[0]) + 'T23:59:59');
  const refundStatute = new Date(due); refundStatute.setFullYear(due.getFullYear() + 3);
  const ty = today.getFullYear();
  let efile;
  if (year >= ty) efile = { ok: false, msg: `Tax year ${year} isn't over yet — IRS e-file opens for it in late January ${year + 1}. You can prepare it now.` };
  else if (year >= ty - 3) {
    const inSeason = today.getMonth() <= 10 && !(today.getMonth() === 10 && today.getDate() > 20);
    const oldest = year === ty - 3;
    if (oldest && !inSeason) efile = { ok: false, msg: `E-file for ${year} has likely closed for good. File on paper (mail).` };
    else if (oldest) efile = { ok: true, msg: `E-file still accepted for ${year} only until the IRS closes this filing season (late November ${ty}). After that, paper only.` };
    else efile = { ok: true, msg: !inSeason ? `IRS e-file is in its year-end pause; ${year} returns can be e-filed again when the IRS reopens it in late January.` : `Eligible for IRS e-file (current year and two prior years).` };
  } else efile = { ok: false, msg: `Too old for IRS e-file — must be mailed on paper.` };
  return { due, refundStatute, efile, pastDue: today > due, refundClosed: today > refundStatute };
}

/* ───────── Validation / error detection ───────── */
const SSN_RE = /^\d{3}-?\d{2}-?\d{4}$/, EIN_RE = /^\d{2}-?\d{7}$/;
function validate(ret, F, S, today) {
  const out = [], add = (sev, msg, tab) => out.push({ sev, msg, tab });
  const d = ret.data, y = +ret.year;
  if (ret.kind === 'business') {
    const B = F;
    if (!d.name) add('error', 'Business name is missing.', 'entity');
    if (!d.ein) add('error', 'EIN is missing.', 'entity'); else if (!EIN_RE.test(d.ein)) add('error', `EIN "${d.ein}" isn't in 12-3456789 format.`, 'entity');
    const pct = (d.owners || []).reduce((s, o) => s + N(o.pct), 0);
    if (Math.abs(pct - 100) > 0.01) add('error', `Ownership percentages add to ${pct}% — must total 100%.`, 'owners');
    if (d.entity === 'scorp' && B.obi > 30000 && N(d.ded.officer) === 0) add('warn', 'S-corp shows profit but $0 officer compensation. The IRS expects reasonable W-2 pay to shareholder-employees.', 'income');
    if (d.entity === 'partnership' && (d.owners || []).length < 2) add('error', 'A partnership return needs at least 2 partners. A single-member LLC files Schedule C on the owner\'s 1040.', 'owners');
    if (d.entity !== 'partnership' && N(d.ded.guaranteed) > 0) add('error', 'Guaranteed payments only apply to partnerships.', 'income');
    if (N(d.cogs) > N(d.gross)) add('warn', 'Cost of goods sold exceeds gross receipts — double-check inventory figures.', 'income');
    if (B.obi < 0) add('info', `Ordinary business loss of $${fmt(-B.obi)}. Owners' ability to deduct it depends on basis and at-risk limits.`, 'review');
    if (d.entity === 'ccorp' && B.fedBal < -500) add('warn', 'C-corps owing $500+ generally must make quarterly estimated payments (Form 2220 penalty risk).', 'pay');
  } else {
    const fs = d.fs;
    if (!d.tp.first || !d.tp.last) add('error', 'Taxpayer name is missing.', 'profile');
    checkSSN(d.tp.ssn, 'Your SSN', add);
    if (!d.tp.dob) add('warn', 'Your date of birth is missing — it\'s needed for age-based rules (65+ deduction, EITC, senior deduction).', 'profile');
    if (fs === 'mfj' || fs === 'mfs') { if (!d.sp.first || !d.sp.last) add('error', 'Spouse name is required for this filing status.', 'profile'); checkSSN(d.sp.ssn, 'Spouse SSN', add); }
    if (fs === 'hoh' && !(d.deps || []).length) add('error', 'Head of household requires a qualifying person (add a dependent).', 'profile');
    if (fs === 'qss' && !(d.deps || []).some(x => ['son', 'daughter', 'child', 'stepchild'].includes((x.rel || '').toLowerCase()))) add('error', 'Qualifying surviving spouse requires a dependent child.', 'profile');
    if (!d.addr.street || !d.addr.zip) add('warn', 'Mailing address is incomplete.', 'profile');
    const ssns = [d.tp.ssn, d.sp.ssn, ...(d.deps || []).map(x => x.ssn)].filter(x => x && !String(x).includes('*')).map(x => String(x).replace(/-/g, ''));
    if (new Set(ssns).size !== ssns.length) add('error', 'The same SSN appears more than once on this return.', 'profile');
    (d.deps || []).forEach((x, i) => { if (!x.name) add('error', `Dependent #${i + 1} has no name.`, 'profile'); checkSSN(x.ssn, `Dependent ${x.name || '#' + (i + 1)} SSN`, add); if (!x.dob) add('warn', `Dependent ${x.name || '#' + (i + 1)}: date of birth needed for Child Tax Credit/EITC.`, 'profile'); });
    // W-2 checks
    const p = P[y];
    const seen = {};
    (d.w2 || []).forEach((w, i) => {
      const nm = w.employer || `W-2 #${i + 1}`;
      if (!w.employer) add('warn', `W-2 #${i + 1}: employer name missing.`, 'income');
      if (w.ein && !EIN_RE.test(w.ein)) add('error', `${nm}: EIN "${w.ein}" is not valid (12-3456789).`, 'income');
      if (N(w.b2) > N(w.b1) && N(w.b1) > 0) add('error', `${nm}: federal withholding (box 2) is more than wages (box 1).`, 'income');
      if (N(w.b3) > p.ssBase) add('error', `${nm}: Social Security wages (box 3) exceed the ${y} wage base of $${fmt(p.ssBase)}.`, 'income');
      if (N(w.b3) && Math.abs(N(w.b4) - N(w.b3) * 0.062) > 5) add('warn', `${nm}: box 4 should be about 6.2% of box 3 ($${fmt(N(w.b3) * 0.062)}); it shows $${fmt(N(w.b4))}.`, 'income');
      if (N(w.b5) && N(w.b6) < N(w.b5) * 0.0145 - 5) add('warn', `${nm}: box 6 should be at least 1.45% of box 5 ($${fmt(N(w.b5) * 0.0145)}).`, 'income');
      if (N(w.b1) > 0 && !N(w.b5)) add('warn', `${nm}: Medicare wages (box 5) is blank.`, 'income');
      if (N(w.b17) > 0 && !w.st) add('error', `${nm}: state withholding entered without a state code (box 15).`, 'income');
      const key = (w.ein || w.employer) + '|' + N(w.b1);
      if (seen[key]) add('error', `${nm}: looks like a duplicate W-2 (same employer and wages).`, 'income'); seen[key] = 1;
      if (w.st && d.resState && w.st.toUpperCase() !== d.resState.toUpperCase()) {
        const pair = [w.st.toUpperCase(), d.resState.toUpperCase()].sort().join('-');
        if (['NJ-PA', 'MD-PA'].includes(pair)) add('warn', `${nm}: you live in ${d.resState} and had ${w.st} tax withheld. ${pair.replace('-', '/')} have a reciprocal agreement — file a ${w.st} nonresident return (${w.st === 'NJ' ? 'NJ-1040NR' : w.st === 'MD' ? 'Form 505' : 'PA-40 NRC'}) to get that withholding back, and give your employer the reciprocity exemption form.`, 'state');
        else add('info', `${nm}: wages earned in ${w.st}. You may need a ${w.st} nonresident return and a credit for taxes paid to another state on your ${d.resState} return (not computed here).`, 'state');
      }
    });
    if ((d.nec || []).length && !(d.biz || []).length) add('error', '1099-NEC income must be attached to a business (Schedule C). Add a business on the Business tab.', 'business');
    (d.nec || []).forEach((n, i) => { if ((d.biz || []).length && !(d.biz || [])[+n.biz || 0]) add('error', `1099-NEC #${i + 1} is linked to a business that doesn't exist.`, 'income'); });
    (d.biz || []).forEach((b, i) => {
      const c = F.biz[i];
      if (!b.name) add('warn', `Business #${i + 1} has no name.`, 'business');
      if (c && c.net < 0) add('warn', `${b.name || 'Business #' + (i + 1)} shows a loss of $${fmt(-c.net)}. Repeated losses can trigger IRS "hobby loss" scrutiny — keep records proving profit motive.`, 'business');
      if (c && c.receipts === 0 && c.exp > 0) add('warn', `${b.name || 'Business #' + (i + 1)}: expenses entered but no income.`, 'business');
      if (N(b.homeSqft) > 300) add('info', `${b.name || 'Business'}: simplified home-office method is capped at 300 sq ft ($1,500).`, 'business');
    });
    if (F.netSE > 0 && F.schC > 0) add('info', `Self-employment tax of $${fmt(F.seTax)} is included (Schedule SE).`, 'review');
    if (F.capCarryOut > 0) add('info', `Capital loss of $${fmt(F.capCarryOut)} carries forward to ${y + 1} (only $${fs === 'mfs' ? '1,500' : '3,000'} is deductible this year).`, 'income');
    (d.r || []).forEach((r, i) => { if (N(r.taxable) > N(r.gross) && N(r.gross) > 0) add('error', `1099-R #${i + 1}: taxable amount is more than the gross distribution.`, 'income'); });
    if (F.earlyDist > 0) add('warn', `10% early-withdrawal penalty of $${fmt(F.earlyPen)} applied (1099-R code 1). If an exception applies, file Form 5329.`, 'income');
    if (N(d.adj.ira) > p.ira + 1000 * (is65(d.tp.dob, y) || ageEOY(d.tp.dob, y) >= 50 ? 1 : 0) * (fs === 'mfj' ? 2 : 1) + (fs === 'mfj' ? p.ira : 0)) add('error', `IRA deduction exceeds the ${y} contribution limit ($${fmt(p.ira)} per person, plus catch-up if 50+).`, 'deductions');
    if (N(d.adj.sli) > 2500) add('warn', 'Student loan interest deduction is capped at $2,500.', 'deductions');
    if (fs === 'mfs' && N(d.adj.sli)) add('error', 'Student loan interest can\'t be deducted when married filing separately.', 'deductions');
    if (N(d.adj.sehi) && F.schC <= 0) add('error', 'Self-employed health insurance requires net self-employment profit.', 'deductions');
    if (!P[y].obbb && (N(d.obb.tips) || N(d.obb.overtime) || N(d.obb.carInt))) add('error', `Tips, overtime and car-loan interest deductions don't exist before 2025 — remove them from this ${y} return.`, 'deductions');
    if (P[y].obbb && fs === 'mfs' && (N(d.obb.tips) || N(d.obb.overtime))) add('error', 'Tips/overtime deductions require a joint return if married.', 'deductions');
    if (N(d.item.salt) + N(d.item.realEstate) > F.saltCap) add('info', `State & local taxes limited to the $${fmt(F.saltCap)} SALT cap.`, 'deductions');
    if (!F.itemized && F.itemTotal > 0) add('info', `Standard deduction ($${fmt(F.sd)}) beats your itemized total ($${fmt(F.itemTotal)}), so it's used.`, 'deductions');
    if (F.itemized && d.item.force && F.itemTotal < F.sd) add('warn', `You forced itemizing, but it's $${fmt(F.sd - F.itemTotal)} less than the standard deduction.`, 'deductions');
    if (N(d.cr.careKids) && fs === 'mfs') add('error', 'Child & dependent care credit is generally not allowed when married filing separately.', 'credits');
    if (N(d.cr.careKids) > (d.deps || []).length) add('warn', 'More child-care children entered than dependents listed.', 'credits');
    if ((d.cr.students || []).filter(s => s.type !== 'llc').length && fs === 'mfs') add('error', 'Education credits are not allowed for married filing separately.', 'credits');
    if (y === 2021 && F.ctcKids && !N(d.cr.advCTC)) add('warn', '2021: enter advance Child Tax Credit payments received (IRS Letter 6419) — they must be reconciled.', 'credits');
    if (y === 2021) add('info', '2021: if you didn\'t get the full third stimulus payment, enter the Recovery Rebate Credit on the Credits tab.', 'credits');
    if (F.eitc > 0) add('info', `Estimated Earned Income Credit: $${fmt(F.eitc)} (${F.eitcKids} qualifying child${F.eitcKids === 1 ? '' : 'ren'}). Confirm eligibility with the IRS EITC Assistant.`, 'credits');
    if (F.qbiOverThreshold) add('warn', 'Income is above the QBI threshold — wage/property limits and specified-service rules (Form 8995-A) may reduce the 20% deduction shown.', 'business');
    if (F.agi > 200000 && F.itemized) add('info', 'High income with itemized deductions — check whether Alternative Minimum Tax (Form 6251) applies; it isn\'t calculated here.', 'review');
    // payments / penalties
    if (F.balance < -1000 && (F.wh + F.addlMedWH + N(d.pay.est)) < 0.9 * F.totalTax) add('warn', `You owe $${fmt(-F.balance)} and paid in less than 90% of your tax — an underpayment penalty (Form 2210) may apply.`, 'pay');
    // deadlines
    const D = deadlines(y, 'individual', null, today);
    if (D.due) {
      if (ret.amendedFrom) {
        if (D.refundClosed && F.balance > 0) add('error', `The refund window for ${y} closed on ${D.refundStatute.toDateString()}. An amendment can no longer produce a refund (you can still amend to pay more).`, 'review');
        if (!ret.amendReason) add('error', 'Explain the changes for Form 1040-X Part II (Amend tab).', 'amend');
      } else {
        if (D.refundClosed && F.balance > 0 && ret.status !== 'filed') add('error', `Refund claims for ${y} expired ${D.refundStatute.toDateString()} — filing now won't get the $${fmt(F.balance)} refund back.`, 'review');
        if (D.pastDue && F.balance < 0 && ret.status !== 'filed') add('warn', `Past the ${D.due.toDateString()} due date with a balance due — late-filing (5%/month) and late-payment penalties plus interest may apply. File and pay ASAP.`, 'review');
      }
      if (!D.efile.ok) add('info', D.efile.msg, 'review');
    }
    // state
    if (S && S.code === 'MD' && !N(d.st.md.rate)) add('error', 'Maryland requires a county/local tax rate (State tab).', 'state');
    if (S && S.code === 'MD' && N(d.st.md.rate) > (y >= 2025 ? 3.3 : 3.2)) add('error', `MD local rate above the ${y >= 2025 ? '3.3' : '3.2'}% legal maximum.`, 'state');
    if (S && S.estimate) add('warn', `${S.code} is calculated as a flat-rate estimate only.`, 'state');
    if (!d.resState) add('warn', 'Resident state not selected.', 'state');
  }
  const order = { error: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.sev] - order[b.sev]);
}
function checkSSN(v, label, add) {
  if (!v) add('error', `${label} is missing.`, 'profile');
  else if (String(v).includes('*')) add('info', `${label} is masked — re-enter the full number before filing.`, 'profile');
  else if (!SSN_RE.test(v)) add('error', `${label} "${v}" isn't a valid 9-digit SSN/ITIN.`, 'profile');
  else { const s = String(v).replace(/-/g, ''); if (s.startsWith('000') || s.startsWith('666') || s.slice(3, 5) === '00' || s.slice(5) === '0000') add('error', `${label} contains an invalid number group.`, 'profile'); }
}
function fmt(x) { return Math.round(N(x)).toLocaleString('en-US'); }

if (typeof module !== 'undefined') module.exports = { P, fed, stateCalc, bizCalc, validate, deadlines, emptyIndividual, emptyBusiness, brTax, brTaxT, N, fmt };
