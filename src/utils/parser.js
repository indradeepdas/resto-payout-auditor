import Papa from 'papaparse';

const SUPPORTED_EXTENSIONS = ['csv', 'xlsx'];
let xlsxModulePromise;

const loadXlsx = async () => {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('xlsx');
  }

  return xlsxModulePromise;
};

const stripBom = (value) => value.replace(/^\uFEFF/, '');

const sanitizeHeaders = (rows) =>
  rows.map((row) => {
    const entries = Object.entries(row || {}).map(([key, value]) => [
      String(key || '').trim(),
      value,
    ]);

    return Object.fromEntries(entries);
  });

const removeEmptyRows = (rows) =>
  rows.filter((row) =>
    Object.values(row || {}).some((value) => String(value ?? '').trim() !== ''),
  );

const ensureRowsExist = (rows, fileName) => {
  if (!rows.length) {
    throw new Error(`"${fileName}" does not contain any data rows.`);
  }

  const headers = Object.keys(rows[0] || {}).filter((header) => header.trim() !== '');

  if (!headers.length) {
    throw new Error(`"${fileName}" is missing usable column headers.`);
  }

  return { rows, headers, fileName };
};

const parseCsv = (file, text) =>
  new Promise((resolve, reject) => {
    Papa.parse(stripBom(text), {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => String(header || '').trim(),
      complete: (results) => {
        if (results.errors?.length) {
          reject(new Error(`Could not parse "${file.name}" as CSV.`));
          return;
        }

        const rows = removeEmptyRows(sanitizeHeaders(results.data));

        try {
          resolve(ensureRowsExist(rows, file.name));
        } catch (error) {
          reject(error);
        }
      },
      error: () => reject(new Error(`Could not parse "${file.name}" as CSV.`)),
    });
  });

const parseWorkbook = async (file, buffer) => {
  const XLSX = await loadXlsx();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error(`"${file.name}" does not contain any worksheets.`);
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = removeEmptyRows(
    sanitizeHeaders(
      XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        raw: false,
      }),
    ),
  );

  return ensureRowsExist(rows, file.name);
};

const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.readAsText(file);
  });

const readFileAsArrayBuffer = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.readAsArrayBuffer(file);
  });

export const parseDataFile = async (file) => {
  if (!file) {
    throw new Error('No file selected.');
  }

  if (!file.size) {
    throw new Error(`"${file.name}" is empty.`);
  }

  const extension = file.name.split('.').pop()?.toLowerCase();

  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new Error(`"${file.name}" is not a supported format. Please upload a CSV or XLSX file.`);
  }

  if (extension === 'csv') {
    const text = await readFileAsText(file);
    return parseCsv(file, text);
  }

  const buffer = await readFileAsArrayBuffer(file);
  return parseWorkbook(file, buffer);
};

export const exportToCsv = (fileName, rows) => {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(fileName, blob);
};

export const exportWorkbook = async (fileName, sheets) => {
  const XLSX = await loadXlsx();
  const workbook = XLSX.utils.book_new();

  sheets.forEach(({ name, rows }) => {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  });

  XLSX.writeFile(workbook, fileName);
};

export const triggerDownload = (fileName, blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
