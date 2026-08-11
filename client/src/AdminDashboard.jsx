/**
 * AdminDashboard.jsx
 * 
 * Admin-only dashboard accessible to users with admin role
 * Shows admin-specific features and management options
 * Fully responsive with mobile sidebar toggle
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import PageHeader from './components/PageHeader';
import { authJsonHeaders } from './utils/apiFetchAll';
import API from './config';
import './Dashboard.css';

const AdminDashboard = () => {
  const { currentUser, onLogout } = useAuth();
  const navigate = useNavigate();
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

  if (currentUser.role !== 'admin') {
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
                className={`nav-link ${activeTab === 'audit' ? 'active' : ''}`}
                onClick={() => handleNavClick('audit', '/audit-logs')}
              >
                📋 Audit Logs
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
            </div>
          </nav>
        </aside>

        <main className="main-content">
          {activeTab === 'overview' && <AdminOverview user={currentUser} />}
        </main>
      </div>
    </div>
  );
};

/**
 * Admin Overview Card - Shows key admin information and quick actions
 */
const AdminOverview = ({ user }) => {
  const [stats, setStats] = useState({ overloaded: [], pending: [], perfect: [] });
  const [loading, setLoading] = useState(true);

  // Filters
  const [yearFilter, setYearFilter] = useState('All');

  // UI state
  const [expandedCard, setExpandedCard] = useState(null); // 'overloaded', 'pending', 'perfect'

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = authJsonHeaders();
        // M-4 FIX: Use server-side analytics endpoint instead of fetching all data client-side
        const params = new URLSearchParams();
        if (yearFilter !== 'All') params.set('year', yearFilter);
        const res = await fetch(`${API}/deva/stats/dashboard-analytics?${params}`, { headers });
        const json = await res.json();
        if (json.success && json.data) {
          setStats({
            overloaded: json.data.overloaded || [],
            pending:    json.data.pending    || [],
            perfect:    json.data.perfect    || [],
          });
        }
      } catch (err) {
        console.error('Error fetching dashboard analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [yearFilter]);

  const handleCardClick = (cardType) => {
    setExpandedCard(expandedCard === cardType ? null : cardType);
  };

  const getActiveList = () => {
    if (expandedCard === 'overloaded') return { title: 'Overloaded Faculty (Exceeding Capacity)', data: stats.overloaded, color: '#dc2626' };
    if (expandedCard === 'pending') return { title: 'Pending Faculty (Under Capacity)', data: stats.pending, color: '#eab308' };
    if (expandedCard === 'perfect') return { title: 'Perfectly Assigned Faculty', data: stats.perfect, color: '#16a34a' };
    return null;
  };

  const activeList = getActiveList();

  return (
    <div className="admin-overview">
      <div className="welcome-card" style={{ marginBottom: '24px' }}>
        <h1>Welcome, Admin {user.name}!</h1>
        <p className="emp-id">Employee ID: {user.id}</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', background: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#4b5563' }}>Filter by Year</label>
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', minWidth: '120px' }}>
            <option value="All">All Years</option>
            <option value="I">I</option>
            <option value="II">II</option>
            <option value="III">III</option>
            <option value="IV">IV</option>
          </select>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="admin-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        
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
