import React, { useState, useEffect, useCallback } from 'react';
import API from '../config';
import { useAcademicPeriod } from '../AcademicPeriodContext';
import { authJsonHeaders } from '../utils/apiFetchAll';
import { useToast } from '../Toast';
import './CourseMainFacultyExportModal.css';

const CourseMainFacultyExportModal = ({
  isOpen,
  onClose,
  initialAcademicYear,
  initialSemester,
  initialProgram = 'All'
}) => {
  const { academicYears: contextAcademicYears, selectedAcademicYear, selectedSemester } = useAcademicPeriod();
  const { showToast } = useToast();

  const [academicYears, setAcademicYears] = useState([]);
  const [programs, setPrograms] = useState(['B.Tech', 'M.Tech']);

  const [academicYear, setAcademicYear] = useState('All');
  const [semester, setSemester] = useState('All');
  const [program, setProgram] = useState('All');

  const [previewCount, setPreviewCount] = useState(null);
  const [isCounting, setIsCounting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');

  // Synchronize initial filter values when modal opens
  useEffect(() => {
    if (isOpen) {
      setAcademicYear(initialAcademicYear || selectedAcademicYear || 'All');
      setSemester(initialSemester || selectedSemester || 'All');
      setProgram(initialProgram || 'All');
      setError('');
    }
  }, [isOpen, initialAcademicYear, initialSemester, initialProgram, selectedAcademicYear, selectedSemester]);

  // Load available academic years
  useEffect(() => {
    if (contextAcademicYears && contextAcademicYears.length > 0) {
      const names = contextAcademicYears.map(ay => ay.name || ay.year).filter(Boolean);
      setAcademicYears(Array.from(new Set(names)));
    } else {
      const token = localStorage.getItem('wlm_token');
      fetch(`${API}/deva/academic-years`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(json => {
          if (json.success && json.data) {
            const list = json.data.map(ay => ay.name || ay.year).filter(Boolean);
            if (list.length > 0) setAcademicYears(Array.from(new Set(list)));
          }
        })
        .catch(() => {});
    }

    // Load available programmes
    const token = localStorage.getItem('wlm_token');
    fetch(`${API}/deva/config`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.programs) {
          const progs = json.data.programs.filter(p => p.isActive).map(p => p.value);
          if (progs.length > 0) {
            setPrograms(Array.from(new Set([...progs, 'B.Tech', 'M.Tech'])).sort());
          }
        }
      })
      .catch(() => {});
  }, [contextAcademicYears]);

  // Fetch preview count whenever filters change
  const fetchPreviewCount = useCallback(async () => {
    if (!isOpen) return;
    try {
      setIsCounting(true);
      setError('');
      const params = new URLSearchParams();
      if (academicYear && academicYear !== 'All') params.append('academicYear', academicYear);
      if (semester && semester !== 'All') params.append('semester', semester);
      if (program && program !== 'All') params.append('program', program);
      params.append('format', 'json');

      const res = await fetch(`${API}/deva/workloads/export/course-main-faculty?${params.toString()}`, {
        headers: authJsonHeaders()
      });
      const data = await res.json();
      if (data.success && data.data) {
        setPreviewCount(data.data.count ?? data.data.rows?.length ?? 0);
      } else {
        setPreviewCount(null);
      }
    } catch {
      setPreviewCount(null);
    } finally {
      setIsCounting(false);
    }
  }, [isOpen, academicYear, semester, program]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreviewCount();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchPreviewCount]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isExporting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  const handleDownload = async (format = 'excel') => {
    try {
      setIsExporting(true);
      setError('');

      const params = new URLSearchParams();
      if (academicYear && academicYear !== 'All') params.append('academicYear', academicYear);
      if (semester && semester !== 'All') params.append('semester', semester);
      if (program && program !== 'All') params.append('program', program);
      params.append('format', format);

      const token = localStorage.getItem('wlm_token');
      const res = await fetch(`${API}/deva/workloads/export/course-main-faculty?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        let errorMsg = 'Failed to download export file.';
        try {
          const errJson = await res.json();
          if (errJson.message) errorMsg = errJson.message;
        } catch {
          // Ignore parse failure
        }
        throw new Error(errorMsg);
      }

      // Extract filename from header or build fallback
      let filename = `Course_Wise_Main_Faculty_Workload_${academicYear}_${semester}_${program}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      const disposition = res.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      if (showToast) {
        showToast.success(`Downloaded ${filename} successfully!`);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Error occurred while generating export.');
      if (showToast) {
        showToast.error(err.message || 'Failed to download export.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cmf-modal-overlay" onClick={() => !isExporting && onClose()}>
      <div className="cmf-modal-card" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="cmf-modal-header">
          <div className="cmf-modal-title-wrap">
            <span className="cmf-modal-icon">📋</span>
            <div>
              <h3>Course-wise Main Faculty Export</h3>
              <p className="cmf-modal-subtitle">
                Export all Main Faculty allocations grouped by course, year, and section
              </p>
            </div>
          </div>
          <button
            className="cmf-modal-close-btn"
            onClick={onClose}
            disabled={isExporting}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="cmf-modal-body">
          {error && (
            <div className="cmf-error-banner">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Filter Selection Grid */}
          <div className="cmf-filter-grid">
            <div className="cmf-form-group">
              <label>Academic Year</label>
              <select
                className="cmf-select"
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
                disabled={isExporting}
              >
                <option value="All">All Academic Years</option>
                {academicYears.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            <div className="cmf-form-group">
              <label>Semester</label>
              <select
                className="cmf-select"
                value={semester}
                onChange={e => setSemester(e.target.value)}
                disabled={isExporting}
              >
                <option value="All">All Semesters (ODD & EVEN)</option>
                <option value="ODD">ODD Semester</option>
                <option value="EVEN">EVEN Semester</option>
              </select>
            </div>

            <div className="cmf-form-group cmf-col-full">
              <label>Programme</label>
              <select
                className="cmf-select"
                value={program}
                onChange={e => setProgram(e.target.value)}
                disabled={isExporting}
              >
                <option value="All">All Programmes (B.Tech, M.Tech, etc.)</option>
                {programs.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Export Specification Info Box */}
          <div className="cmf-info-box">
            <div className="cmf-info-title">
              <span>Excel Output Columns</span>
              <span className="cmf-count-badge">
                {isCounting ? 'Counting...' : (previewCount !== null ? `${previewCount} rows match` : 'Dynamic')}
              </span>
            </div>

            <div className="cmf-columns-list">
              <span className="cmf-column-chip">
                <span className="cmf-column-num">1.</span> Course Code
              </span>
              <span className="cmf-column-chip">
                <span className="cmf-column-num">2.</span> Course Name
              </span>
              <span className="cmf-column-chip">
                <span className="cmf-column-num">3.</span> Main Faculty Assigned
              </span>
              <span className="cmf-column-chip">
                <span className="cmf-column-num">4.</span> Year
              </span>
              <span className="cmf-column-chip">
                <span className="cmf-column-num">5.</span> Section
              </span>
            </div>

            <p className="cmf-rules-hint">
              • Displays one row for each unique course, year, and section.<br />
              • If multiple Main Faculty are assigned to the same section, all their names are combined.<br />
              • Includes only actual Main Faculty allocations (Supporting Faculty and TAs excluded).
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="cmf-modal-footer">
          <button
            type="button"
            className="cmf-btn cmf-btn-cancel"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </button>

          <button
            type="button"
            className="cmf-btn cmf-btn-secondary"
            onClick={() => handleDownload('csv')}
            disabled={isExporting || previewCount === 0}
            title="Download Course Main Faculty as CSV"
          >
            Export CSV
          </button>

          <button
            type="button"
            className="cmf-btn cmf-btn-primary"
            onClick={() => handleDownload('excel')}
            disabled={isExporting || previewCount === 0}
            title="Download Course Main Faculty as formatted Excel workbook"
          >
            {isExporting ? (
              <>
                <span className="cmf-spinner"></span>
                Generating Excel...
              </>
            ) : (
              <>
                📊 Export Excel (.xlsx)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseMainFacultyExportModal;

