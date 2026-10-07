import Papa from 'papaparse';
export function parseCSV(text) {
  // Remove final line endings, but preserve empty cells and explicitly quoted empty rows.
  const result = Papa.parse(text.replace(/(?:\r?\n)+$/, ''), { header: true, skipEmptyLines: false, transformHeader: h => h.trim() });
  const errors = result.errors.filter(error => error.code !== 'UndetectableDelimiter');
  if (errors.length) throw new Error(`CSV error: ${errors[0].message}`);
  return result;
}
