const E = require('./engine.js');
function mk(year, f) { const d = E.emptyIndividual(); f(d); return { kind: 'individual', year, data: d }; }
// Single, $60k wages, 2024 → TI 45,400 → tax from table: 5,216 (IRS table row 45,400-45,450)
let r = mk(2024, d => { d.tp = { first: 'A', last: 'B', ssn: '123-45-6789', dob: '1990-01-01' }; d.w2 = [{ employer: 'X', ein: '12-3456789', b1: 60000, b2: 6000, b3: 60000, b4: 3720, b5: 60000, b6: 870, st: 'PA', b16: 60000, b17: 1842 }]; });
let F = E.fed(r); console.log('2024 single 60k: TI', F.ti, 'tax', F.tax, 'bal', F.balance);
let S = E.stateCalc(r, F); console.log(' PA tax', S.tax, 'bal', S.bal);
console.log(E.validate(r, F, S, new Date('2026-11-15')).map(x => x.sev + ': ' + x.msg));
// MFJ 2025, two kids, $120k wages, Sch C 30k
r = mk(2025, d => { d.fs = 'mfj'; d.tp = { first: 'A', last: 'B', ssn: '123-45-6789', dob: '1985-01-01' }; d.sp = { first: 'C', last: 'B', ssn: '223-45-6789', dob: '1986-01-01' }; d.resState = 'MD';
  d.deps = [{ name: 'K1', ssn: '323-45-6789', rel: 'son', dob: '2015-05-01' }, { name: 'K2', ssn: '423-45-6789', rel: 'daughter', dob: '2020-05-01' }];
  d.w2 = [{ employer: 'Y', b1: 120000, b2: 9000, b3: 120000, b4: 7440, b5: 120000, b6: 1740, st: 'MD', b16: 120000, b17: 5500 }];
  d.biz = [{ name: 'Notary', gross: 30000, exp: { supplies: 2000 } }]; d.st.md.rate = '3.2'; });
F = E.fed(r); S = E.stateCalc(r, F);
console.log('2025 MFJ: AGI', Math.round(F.agi), 'SE', Math.round(F.seTax), 'QBI', Math.round(F.qbi), 'TI', Math.round(F.ti), 'tax', F.tax, 'ctcUsed', F.ctcUsed, 'total', Math.round(F.totalTax), 'bal', F.balance);
console.log(' MD', S.lines.map(l => l[0] + '=' + Math.round(+l[1] || 0)).join(' | '), 'bal', S.bal);
// 2021 single parent HoH with 1 kid age 4, 30k wages, advance CTC 1800
r = mk(2021, d => { d.fs = 'hoh'; d.tp = { first: 'A', last: 'B', ssn: '123-45-6789', dob: '1990-01-01' }; d.resState = 'NJ';
  d.deps = [{ name: 'K', ssn: '323-45-6789', rel: 'son', dob: '2017-05-01' }]; d.cr.advCTC = 1800;
  d.w2 = [{ employer: 'Z', b1: 30000, b2: 1000, b3: 30000, b4: 1860, b5: 30000, b6: 435, st: 'NJ', b16: 30000, b17: 400 }]; });
F = E.fed(r); S = E.stateCalc(r, F);
console.log('2021 HoH: TI', F.ti, 'tax', F.tax, 'ctcRef', F.ctc2021Ref, 'eitc', F.eitc, 'bal', F.balance, '| NJ tax', S.tax.toFixed(0), 'bal', S.bal);
console.log(E.validate(r, F, S, new Date('2026-11-15')).map(x => x.sev + ': ' + x.msg));
// cap gains check 2026 single: wages 40k + LTCG 20k
r = mk(2026, d => { d.tp = { first: 'A', last: 'B', ssn: '123-45-6789', dob: '1960-01-01' }; d.w2 = [{ b1: 40000, b3: 40000, b4: 2480, b5: 40000, b6: 580 }]; d.cg.lt = 20000; d.obb.tips = 5000; });
F = E.fed(r); console.log('2026 single 65+: sd', F.sd, 'senior', F.senior, 'tips', F.tips, 'TI', F.ti, 'tax', F.tax);
console.log(E.deadlines(2023, 'individual', null, new Date('2026-11-15')));
console.log(E.bizCalc({ kind: 'business', year: 2025, data: Object.assign(E.emptyBusiness(), { entity: 'ccorp', st: 'PA', gross: 500000, ded: { salaries: 300000 } }) }));
