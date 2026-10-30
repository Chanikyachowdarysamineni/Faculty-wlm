/**
 * AdminDashboard.jsx
 * 
 * Admin-only dashboard accessible to users with admin role
 * Shows admin-specific features and management options
 * Fully responsive with mobile sidebar toggle
 */

import React, { useState, useEffect } from 'react';
import { useAcademicPeriod } from './AcademicPeriodContext';
import GlobalPeriodSelector from './components/GlobalPeriodSelector';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import PageHeader from './components/PageHeader';
import AdminManagement from './components/AdminManagement';
import DesignationManagementModal from './components/DesignationManagementModal';
import { authJsonHeaders } from './utils/apiFetchAll';
import API from './config';
import { useSharedData } from './DataContext';
import './Dashboard.css';

const AdminDashboard = () => {
  const { currentUser, onLogout } = useAuth();
  const navigate = useNavigate();
  const { selectedSemester } = useAcademicPeriod();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  // Close sidebar when a nav item is clicked on mobile
  const handleNavClick = (tab, path) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    if (path) navigate(path);
  };

  // Close sidebar when clicking overlay on mobile
  const handleSidebarOverlayClick = () => {
    setSidebarOpen(false);
  };

  // Close sidebar on screen resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Redirect to login if not authenticated or not admin
  if (!currentUser) {
    navigate('/login', { replace: true });
    return null;
  }

  if (currentUser.role !== 'admin' && currentUser.role !== 'Admin') {
    navigate('/', { replace: true });
    return null;
  }

  return (
    <div className="dashboard">
      <PageHeader 
        user={currentUser} 
        onLogout={handleLogout}
        isAdmin={true}
        onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="dashboard-content">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="sidebar-overlay open"
            onClick={handleSidebarOverlayClick}
          />
        )}

        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <nav className="sidebar-nav">
            <h3 className="sidebar-title">Admin Panel</h3>
            
            <div className="nav-section">
              <button
                className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => handleNavClick('overview')}
              >
                📊 Overview
              </button>
              <button
                className={`nav-link ${activeTab === 'faculty' ? 'active' : ''}`}
                onClick={() => handleNavClick('faculty', '/faculty')}
              >
                👥 Manage Faculty
              </button>
              <button
                className={`nav-link ${activeTab === 'courses' ? 'active' : ''}`}
                onClick={() => handleNavClick('courses', '/courses')}
              >
                📚 Manage Courses
              </button>
              <button
                className={`nav-link ${activeTab === 'workload' ? 'active' : ''}`}
                onClick={() => handleNavClick('workload', '/workload')}
              >
                💼 Workload Management
              </button>
              <button
                className={`nav-link ${activeTab === 'capacity' ? 'active' : ''}`}
                onClick={() => handleNavClick('capacity', '/capacity')}
              >
                ⏱️ Capacity Management
              </button>

              <button
                className={`nav-link ${activeTab === 'sections' ? 'active' : ''}`}
                onClick={() => handleNavClick('sections', '/sections')}
              >
                🎓 Section Management
              </button>
              <button
                className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => handleNavClick('settings', '/settings')}
              >
                ⚙️ Settings
              </button>
              <button
                className={`nav-link ${activeTab === 'admin-management' ? 'active' : ''}`}
                onClick={() => handleNavClick('admin-management')}
              >
                🔐 Admin Management
              </button>
              <button
                className={`nav-link ${activeTab === 'designations' ? 'active' : ''}`}
                onClick={() => handleNavClick('designations')}
              >
                🏷️ Manage Designations
              </button>
            </div>
          </nav>
        </aside>

        <main className="main-content">
          {activeTab === 'overview' && <AdminOverview user={currentUser} selectedSemester={selectedSemester} />}
          {activeTab === 'admin-management' && <AdminManagement user={currentUser} />}
          {activeTab === 'designations' && (
             <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
               <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#1e293b' }}>Manage Designations</h2>
               <DesignationManagementModal onClose={() => handleNavClick('overview')} isStandalone={true} />
             </div>
          )}
        </main>
      </div>
    </div>
  );
};

/**
 * Admin Overview Card - Shows key admin information and quick actions
 */
const AdminOverview = ({ user }) => {
  const navigate = useNavigate();
  const { selectedAcademicYear, selectedSemester } = useAcademicPeriod();
  const [stats, setStats] = useState({ overloaded: [], pending: [], perfect: [], designationStats: [] });
  const [loading, setLoading] = useState(true);
  const [desigTab, setDesigTab] = useState('ALL'); // 'ALL', 'TA', 'FACULTY'

  // UI state for overview cards
  const [expandedCard, setExpandedCard] = useState(null); // 'overloaded', 'pending', 'perfect'

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = authJsonHeaders();
        const params = new URLSearchParams();
        if (selectedAcademicYear) params.append('academicYear', selectedAcademicYear);
        if (selectedSemester) params.append('semester', selectedSemester);

        const res = await fetch(`${API}/deva/stats/dashboard-analytics?${params.toString()}`, { headers });
        const json = await res.json();
        if (json.success && json.data) {
          setStats({
            overloaded: json.data.overloaded || [],
            pending:    json.data.pending    || [],
            perfect:    json.data.perfect    || [],
            designationStats: json.data.designationStats || json.data.taDesignationStats || []
          });
        }
      } catch (err) {
        console.error('Error fetching dashboard analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const handleReload = () => { fetchData(); };
    window.addEventListener('wlm:designations_reload', handleReload);
    return () => {
      window.removeEventListener('wlm:designations_reload', handleReload);
    };
  }, [selectedAcademicYear, selectedSemester]);

  const handleCardClick = (cardType) => {
    setExpandedCard(expandedCard === cardType ? null : cardType);
  };

  const getActiveList = () => {
    if (expandedCard === 'overloaded') return { title: 'Overloaded Faculty (Exceeding Capacity)', data: stats.overloaded, color: '#dc2626' };
    if (expandedCard === 'pending') return { title: 'Pending Faculty (Under Capacity)', data: stats.pending, color: '#eab308' };
    if (expandedCard === 'perfect') return { title: 'Perfectly Assigned Faculty', data: stats.perfect, color: '#16a34a' };
    return null;
  };

  const isTaDesignation = (name = '') => {
    const n = String(name || '').toLowerCase();
    return n.includes('teaching associate') || n.includes('teaching assistant') || n.includes('teaching instructor') || n.startsWith('ta');
  };

  const rawDesignations = stats.designationStats || [];
  const taDesignationsCount = rawDesignations.filter(d => isTaDesignation(d.designation || d.name)).length;
  const facultyDesignationsCount = rawDesignations.filter(d => !isTaDesignation(d.designation || d.name)).length;

  const displayedDesignationStats = useMemo(() => {
    if (desigTab === 'TA') {
      return rawDesignations.filter(d => isTaDesignation(d.designation || d.name));
    }
    if (desigTab === 'FACULTY') {
      return rawDesignations.filter(d => !isTaDesignation(d.designation || d.name));
    }
    return rawDesignations;
  }, [rawDesignations, desigTab]);

  const totalDesignationFacultyCount = useMemo(() => {
    return (rawDesignations || []).reduce((sum, d) => sum + (Number(d.count) || 0), 0);
  }, [rawDesignations]);

  const displayedDesignationFacultyCount = useMemo(() => {
    return (displayedDesignationStats || []).reduce((sum, d) => sum + (Number(d.count) || 0), 0);
  }, [displayedDesignationStats]);

  const activeList = getActiveList();

  return (
    <div className="admin-overview">
      <div className="welcome-card" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Welcome, Admin {user?.name || 'Administrator'}!</h1>
          <p className="emp-id" style={{ marginTop: '4px' }}>Employee ID: {user?.id || user?.empId || ''}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <GlobalPeriodSelector />
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="admin-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        
        {/* Total Faculty Card */}
        <div 
          className="stat-card" 
          style={{ transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
        >
          <div className="stat-icon" style={{ background: '#eef0fd', color: '#6b74e8' }}>👥</div>
          <div className="stat-content">
            <h3 style={{ color: '#4338ca' }}>Total Faculty</h3>
            <p className="stat-value">{loading ? '...' : (stats.overloaded.length + stats.pending.length + stats.perfect.length)}</p>
            <p className="stat-desc">All Active Faculty in Period</p>
          </div>
        </div>

        {/* Overloaded Card */}
        <div 
          className="stat-card" 
          onClick={() => handleCardClick('overloaded')}
          style={{ cursor: 'pointer', border: expandedCard === 'overloaded' ? '2px solid #dc2626' : '1px solid transparent', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
        >
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>⚠️</div>
          <div className="stat-content">
            <h3 style={{ color: '#991b1b' }}>Overloaded</h3>
            <p className="stat-value">{loading ? '...' : stats.overloaded.length}</p>
            <p className="stat-desc">Assigned &gt; Capacity</p>
          </div>
        </div>

        {/* Pending Card */}
        <div 
          className="stat-card" 
          onClick={() => handleCardClick('pending')}
          style={{ cursor: 'pointer', border: expandedCard === 'pending' ? '2px solid #eab308' : '1px solid transparent', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
        >
          <div className="stat-icon" style={{ background: '#fef9c3', color: '#ca8a04' }}>⏳</div>
          <div className="stat-content">
            <h3 style={{ color: '#854d0e' }}>Pending</h3>
            <p className="stat-value">{loading ? '...' : stats.pending.length}</p>
            <p className="stat-desc">Assigned &lt; Capacity</p>
          </div>
        </div>

        {/* Perfect Card */}
        <div 
          className="stat-card" 
          onClick={() => handleCardClick('perfect')}
          style={{ cursor: 'pointer', border: expandedCard === 'perfect' ? '2px solid #16a34a' : '1px solid transparent', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
        >
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>✅</div>
          <div className="stat-content">
            <h3 style={{ color: '#166534' }}>Perfect</h3>
            <p className="stat-value">{loading ? '...' : stats.perfect.length}</p>
            <p className="stat-desc">Assigned = Capacity</p>
          </div>
        </div>

      </div>

      {/* Dynamic Designation-Wise Workload & Capacity Section */}
      <div style={{ background: '#ffffff', padding: '20px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🏛️</span> Designation-Wise Workload &amp; Capacity
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Database-driven cards for all active designations. Click any card to view detailed faculty assignments.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Small Box: All Designations Faculty Count */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#eef2ff',
              border: '1px solid #c7d2fe',
              padding: '5px 12px',
              borderRadius: '10px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}>
              <span style={{ fontSize: '15px' }}>👥</span>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span style={{ fontSize: '10px', color: '#6366f1', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Total Faculty
                </span>
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#3730a3' }}>
                  {totalDesignationFacultyCount} {desigTab !== 'ALL' && <span style={{ fontSize: '11px', fontWeight: 600, color: '#6366f1' }}>({displayedDesignationFacultyCount} in view)</span>}
                </span>
              </div>
            </div>

            {/* Academic Period Badge */}
            <span style={{
              fontSize: '12px',
              color: '#0369a1',
              background: '#e0f2fe',
              border: '1px solid #bae6fd',
              padding: '6px 12px',
              borderRadius: '10px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>📅</span>
              <span>{selectedAcademicYear || '2026-2027'} • {selectedSemester || 'ODD'} Semester</span>
            </span>

            {desigTab === 'TA' && (
              <span style={{ fontSize: '12px', color: '#6b7280', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: '10px', fontWeight: 500 }}>
                Permitted for R2, R3, R4 Allocations Only
              </span>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setDesigTab('ALL')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: desigTab === 'ALL' ? '#4f46e5' : '#f1f5f9',
              color: desigTab === 'ALL' ? '#ffffff' : '#475569',
              transition: 'all 0.2s'
            }}
          >
            All Designations ({rawDesignations.length})
          </button>
          <button
            type="button"
            onClick={() => setDesigTab('TA')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: desigTab === 'TA' ? '#4f46e5' : '#f1f5f9',
              color: desigTab === 'TA' ? '#ffffff' : '#475569',
              transition: 'all 0.2s'
            }}
          >
            TA &amp; Instructors ({taDesignationsCount})
          </button>
          <button
            type="button"
            onClick={() => setDesigTab('FACULTY')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: desigTab === 'FACULTY' ? '#4f46e5' : '#f1f5f9',
              color: desigTab === 'FACULTY' ? '#ffffff' : '#475569',
              transition: 'all 0.2s'
            }}
          >
            Faculty Roles ({facultyDesignationsCount})
          </button>
        </div>

        {/* Dynamic Designation Cards Grid */}
        {loading ? (
          <div className="admin-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="stat-card" style={{ padding: '24px 20px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', minHeight: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ fontSize: '22px', marginBottom: '8px' }}>⏳</div>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Loading designation analytics...</div>
              </div>
            ))}
          </div>
        ) : displayedDesignationStats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
            <div style={{ fontWeight: 600 }}>No designations available in this category.</div>
          </div>
        ) : (
          <div className="admin-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
            {displayedDesignationStats.map((item) => {
              const desigId = item.id || item.designationId || item._id;
              const isTA = isTaDesignation(item.designation || item.name);
              const isOver = item.remainingCapacity < 0 || item.isOverloaded;
              return (
                <div
                  className="stat-card"
                  key={desigId || item.designation}
                  onClick={() => desigId && navigate(`/admin/designations/${desigId}`)}
                  style={{
                    cursor: 'pointer',
                    border: isOver ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderRadius: '10px',
                    background: '#ffffff',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.08)';
                    e.currentTarget.style.borderColor = '#4f46e5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.borderColor = isOver ? '#fca5a5' : '#e2e8f0';
                  }}
                  title="Click to view full faculty list and workload details"
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px', gap: '8px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                          {item.designation || item.name}
                        </h3>
                        <span style={{ fontSize: '11px', color: isTA ? '#4338ca' : '#64748b', fontWeight: 500, background: isTA ? '#eef2ff' : '#f8fafc', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>
                          {isTA ? 'TA / Instructor (R2-R4)' : 'Faculty Role'}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '26px', fontWeight: 800, color: '#4f46e5', lineHeight: 1 }}>
                          {item.count}
                        </span>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>FACULTY</div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center' }}>
                      <div style={{ background: '#f8fafc', padding: '6px 2px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>Assigned</div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{item.totalAllocated}h</div>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '6px 2px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>Capacity</div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{item.totalCapacity}h</div>
                      </div>
                      <div style={{ background: isOver ? '#fef2f2' : '#f0fdf4', padding: '6px 2px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '10.5px', color: isOver ? '#b91c1c' : '#15803d', fontWeight: 600 }}>Remaining</div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: isOver ? '#dc2626' : item.remainingCapacity === 0 ? '#16a34a' : '#0284c7' }}>
                          {item.remainingCapacity}h
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {isOver ? (
                      <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700 }}>
                        ⚠ Over by {Math.abs(item.remainingCapacity)}h
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                        ✓ Within Capacity
                      </span>
                    )}
                    <span style={{ fontSize: '11.5px', color: '#4f46e5', fontWeight: 600 }}>
                      View Details →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detailed Faculty List (Expanded) */}
      {activeList && (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${activeList.color}`, paddingBottom: '12px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: activeList.color }}>{activeList.title} ({activeList.data.length})</h3>
            <button 
              onClick={() => setExpandedCard(null)}
              style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}
            >×</button>
          </div>
          
          {activeList.data.length === 0 ? (
            <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No faculty found in this category.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                    <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>Emp ID</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>Designation</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>Capacity</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>Assigned</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {activeList.data.map((f, i) => (
                    <tr key={f.empId} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontWeight: 500 }}>{f.empId}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{f.name}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{f.designation}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 600 }}>{f.capacity}h</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 600, color: activeList.color }}>{f.assignedHours}h</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 600, color: f.pendingLoad < 0 ? '#dc2626' : f.pendingLoad > 0 ? '#ca8a04' : '#16a34a' }}>
                        {f.pendingLoad > 0 ? `+${f.pendingLoad}h` : `${f.pendingLoad}h`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
