/**
 * ════════════════════════════════════════════════════════════════════════
 * RESPONSIVE TABLE COMPONENT
 * ════════════════════════════════════════════════════════════════════════
 * 
 * Mobile-friendly table that converts to card layout on small screens
 * - Horizontal scroll on tablets
 * - Card layout on mobile
 * - Maintains data visibility
 * - Touch-friendly interactions
 */

import React from 'react';
import './ResponsiveTable.css';

/**
 * ResponsiveTable Component
 * Renders a responsive table with mobile fallback
 * 
 * @param {Array} columns - Table columns with { key, label, render? }
 * @param {Array} rows - Table data rows
 * @param {boolean} stacked - Force stacked layout on all sizes
 */
const ResponsiveTable = ({ columns = [], rows = [], stacked = false }) => {
  if (!columns.length || !rows.length) {
    return <div className="responsive-table-empty">No data available</div>;
  }

  return (
    <div className={`responsive-table ${stacked ? 'stacked-mobile' : ''}`}>
      {/* Desktop table view */}
      <table className="table-desktop">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={`${idx}-${col.key}`}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile card view */}
      <div className="table-mobile">
        {rows.map((row, idx) => (
          <div key={idx} className="table-card">
            {columns.map((col) => (
              <div key={`${idx}-${col.key}`} className="table-card-row">
                <span className="table-card-label">{col.label}</span>
                <span className="table-card-value">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResponsiveTable;
