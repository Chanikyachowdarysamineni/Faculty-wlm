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
  const [facultyCount, setFacultyCount] = useState(0);
  const [overloadedFaculty, setOverloadedFaculty] = useState([]);

  useEffect(() => {
    // Fetch faculty count and overloaded faculty data
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch faculty count
      const facultyRes = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/deva'}/faculty`);
      if (facultyRes.ok) {
        const facultyData = await facultyRes.json();
        setFacultyCount(facultyData.length);
      }

      // Fetch workload to find overloaded faculty
      const workloadRes = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/deva'}/workloads`);
      if (workloadRes.ok) {
        const workloadData = await workloadRes.json();
        const overloaded = workloadData.filter(w => w.totalLoad > w.maxLoad);
        setOverloadedFaculty(overloaded);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  return (
    <div className="admin-overview">
      <div className="welcome-card">
        <h1>Welcome, Admin {user.name}!</h1>
        <p className="emp-id">Employee ID: {user.id}</p>
      </div>

      <div className="admin-stats">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>Faculty Count</h3>
            <p className="stat-value">{facultyCount}</p>
            <p className="stat-desc">Total faculty members</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <h3>Overloaded Faculty</h3>
            <p className="stat-value">{overloadedFaculty.length}</p>
            <p className="stat-desc">Faculty exceeding max workload</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
