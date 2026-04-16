import React from 'react';
import { useToast } from '../Toast';
import './ExportButtons.css';

/**
 * ExportButtons - Reusable component for CSV/Excel export
 * 
 * Usage:
 * <ExportButtons
 *   onExportCSV={() => exportCoursesList(courseList)}
 *   onExportExcel={() => exportCoursesListExcel(courseList)}
 * />
 */
const ExportButtons = ({ 
  onExportCSV, 
  onExportExcel,
  onPrint = null,
  label = 'Export'
}) => {
  const { showToast } = useToast();

  const handleExportCSV = () => {
    try {
      onExportCSV();
      showToast({ type: 'success', message: `${label} exported as CSV` });
    } catch (err) {
      showToast({ type: 'error', message: `Failed to export CSV: ${err.message}` });
    }
  };

  const handleExportExcel = () => {
    try {
      onExportExcel();
      showToast({ type: 'success', message: `${label} exported as Excel` });
    } catch (err) {
      showToast({ type: 'error', message: `Failed to export Excel: ${err.message}` });
    }
  };

  const handlePrint = () => {
    try {
      onPrint();
      showToast({ type: 'success', message: 'Opening print dialog...' });
    } catch (err) {
      showToast({ type: 'error', message: `Failed to print: ${err.message}` });
    }
  };

  return (
    <div className="export-buttons">
      <button 
        className="export-btn export-csv"
        onClick={handleExportCSV}
        title={`Export as CSV`}
      >
        📥 CSV
      </button>
      <button 
        className="export-btn export-excel"
        onClick={handleExportExcel}
        title={`Export as Excel`}
      >
        📊 Excel
      </button>
      {onPrint && (
        <button 
          className="export-btn export-print"
          onClick={handlePrint}
          title="Print"
        >
          🖨️ Print
        </button>
      )}
    </div>
  );
};

export default ExportButtons;

