import React from 'react';
import SearchBar from './SearchBar';
import ExportButtons from './ExportButtons';
import './PageHeader.css';

/**
 * PageHeader - Reusable page header with title, search, and export
 * 
 * Usage:
 * <PageHeader
 *   title="Courses"
 *   totalCount={courseList.length}
 *   searchValue={search}
 *   onSearchChange={(e) => setSearch(e.target.value)}
 *   searchPlaceholder="Search courses..."
 *   onExportCSV={() => exportCoursesList(courseList)}
 *   onExportExcel={() => exportCoursesListExcel(courseList)}
 * />
 */
const PageHeader = ({
  title,
  totalCount,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  onExportCSV,
  onExportExcel,
  onPrint = null,
  additionalInfo = null,
  children = null,
}) => {
  return (
    <div className="page-header">
      <div className="page-header-left">
        <div className="page-header-title-group">
          <h1 className="page-header-title">{title}</h1>
          {totalCount !== undefined && (
            <span className="page-header-count">{totalCount} total</span>
          )}
        </div>
        {additionalInfo && (
          <p className="page-header-info">{additionalInfo}</p>
        )}
      </div>

      <div className="page-header-right">
        {onSearchChange && (
          <SearchBar
            value={searchValue}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
          />
        )}

        {(onExportCSV || onExportExcel) && (
          <ExportButtons
            onExportCSV={onExportCSV}
            onExportExcel={onExportExcel}
            onPrint={onPrint}
            label={title}
          />
        )}

        {children}
      </div>
    </div>
  );
};

export default PageHeader;

