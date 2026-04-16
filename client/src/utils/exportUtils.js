import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const safeValue = (value) => (value === null || value === undefined ? '' : value);

const buildMatrix = (columns, rows) => {
  const headers = columns.map(c => c.header);
  const body = rows.map((row) => columns.map((c) => safeValue(typeof c.value === 'function' ? c.value(row) : row[c.key])));
  return { headers, body };
};

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const exportAsCSV = ({ fileName, columns, rows }) => {
  const { headers, body } = buildMatrix(columns, rows);
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(','), ...body.map(r => r.map(esc).join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
};

export const exportAsExcel = ({ fileName, columns, rows, sheetName = 'Sheet1' }) => {
  const mappedRows = rows.map((row) => {
    const out = {};
    columns.forEach((c) => {
      out[c.header] = safeValue(typeof c.value === 'function' ? c.value(row) : row[c.key]);
    });
    return out;
  });

  const worksheet = XLSX.utils.json_to_sheet(mappedRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
};

export const exportAsPDF = ({ fileName, title, columns, rows }) => {
  const { headers, body } = buildMatrix(columns, rows);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(12);
  doc.text(title || fileName, 40, 32);
  autoTable(doc, {
    startY: 46,
    head: [headers],
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59] },
  });
  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
};

