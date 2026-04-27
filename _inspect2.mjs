import * as XLSX from 'xlsx';
const wb = XLSX.readFile('/tmp/controle.xlsx');

// CONTROLE DIÁRIO - get all rows of column A-J (descriptions and prices)
const cd = wb.Sheets['CONTROLE DIÁRIO'];
const cdData = XLSX.utils.sheet_to_json(cd, { header: 1, raw: true, defval: null });
console.log('=== CONTROLE DIÁRIO rows 4-50 (cols 1-10) ===');
for (let i = 3; i < cdData.length; i++) {
  const r = cdData[i];
  if (!r) continue;
  console.log(i+1, JSON.stringify(r.slice(0, 11)));
}

// RELATÓRIO DE HORAS M.O. - col headers
console.log('\n=== HORAS M.O. row 6 (headers) and rows 8-20 ===');
const hm = wb.Sheets['RELATÓRIO DE HORAS M.O.'];
const hmData = XLSX.utils.sheet_to_json(hm, { header: 1, raw: true, defval: null });
console.log('headers:', JSON.stringify(hmData[5]));
for (let i = 7; i < Math.min(40, hmData.length); i++) {
  console.log(i+1, JSON.stringify(hmData[i]));
}
