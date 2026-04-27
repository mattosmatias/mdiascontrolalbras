import * as XLSX from 'xlsx';
const wb = XLSX.readFile('/tmp/controle.xlsx');
console.log('Sheets:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  console.log(`\n=== ${name} (${data.length} rows) ===`);
  for (let i = 0; i < Math.min(15, data.length); i++) {
    console.log(i+1, JSON.stringify(data[i]));
  }
}
