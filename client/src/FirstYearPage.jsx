import React, { useState, useEffect, useMemo } from 'react';
import API from './config';
import { fetchAllPages, authJsonHeaders } from './utils/apiFetchAll';
import { useToast } from './Toast';
import './FirstYearPage.css';

const FirstYearPage = () => {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [facultyMaster, setFacultyMaster] = useState([]);
  const [coursesMaster, setCoursesMaster] = useState([]);
  
  const [search, setSearch] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  
  const [deleteItem, setDeleteItem] = useState(null);

  const { showToast } = useToast();

  const emptyForm = {
    academicYear: '2023-2024',
    empId: '',
    subjectCode: '',
    branch: '',
    sections: '',
    workloadText: '',
    cluster: '',
    allocationStatus: 'Active'
  };
  
  const [formData, setFormData] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = authJsonHeaders();
      const [assRes, facRes, couRes] = await Promise.all([
        fetch(`${API}/deva/first-year/assignments`, { headers }).then(res => res.json()),
        fetchAllPages('/deva/faculty', {}, { headers }),
        fetchAllPages('/deva/courses', {}, { headers })
      ]);

      if (assRes.success) setAssignments(assRes.data || []);
      if (facRes.success) setFacultyMaster(facRes.data || []);
      if (couRes.success) setCoursesMaster(couRes.data || []);
    } catch (err) {
      showToast('Error fetching data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return assignments.filter(a => 
      (a.empName && a.empName.toLowerCase().includes(q)) ||
      (a.subjectName && a.subjectName.toLowerCase().includes(q)) ||
      (a.subjectCode && a.subjectCode.toLowerCase().includes(q)) ||
      (a.cluster && a.cluster.toLowerCase().includes(q)) ||
      (a.branch && a.branch.toLowerCase().includes(q))
    );
  }, [assignments, search]);

  const handleFacultyChange = (empId) => {
    const faculty = facultyMaster.find(f => f.empId === empId);
    setFormData(prev => ({
      ...prev,
      empId,
      cluster: faculty ? (faculty.cluster || faculty.department || '') : prev.cluster
    }));
  };

  const openAdd = () => {
    setEditItem(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setFormData({
      academicYear: item.academicYear || '2023-2024',
      empId: item.empId || '',
      subjectCode: item.subjectCode || '',
      branch: item.branch || '',
      sections: item.sections ? item.sections.join(', ') : '',
      workloadText: item.workloadText || '',
      cluster: item.cluster || '',
      allocationStatus: item.allocationStatus || 'Active'
    });
    setShowModal(true);
  };

  const saveForm = async () => {
    if (!formData.empId || !formData.subjectCode || !formData.branch || !formData.workloadText) {
      showToast('Please fill all required fields');
      return;
    }

    const payload = {
      ...formData,
      sections: formData.sections.split(',').map(s => s.trim()).filter(Boolean)
    };

    try {
      const url = editItem ? `${API}/deva/first-year/assignments/${editItem._id}` : `${API}/deva/first-year/assignments`;
      const method = editItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authJsonHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showToast(editItem ? 'Assignment updated' : 'Assignment created');
        setShowModal(false);
        loadData();
      } else {
        showToast(data.message || data.errors?.join(', ') || 'Failed to save');
      }
    } catch (err) {
      showToast('Error saving assignment');
    }
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      const res = await fetch(`${API}/deva/first-year/assignments/${deleteItem._id}`, {
        method: 'DELETE',
        headers: authJsonHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showToast('Assignment deleted');
        setDeleteItem(null);
        loadData();
      } else {
        showToast(data.message || 'Failed to delete');
      }
    } catch (err) {
      showToast('Error deleting assignment');
    }
  };

  if (loading) {
    return <div className="fyp-wrapper">Loading 1st Year Data...</div>;
  }

  return (
    <div className="fyp-wrapper">
      <div className="fyp-topbar">
        <div>
          <h2 className="fyp-title">1st-Year Courses Management</h2>
          <div className="fyp-sub">Dynamic assignment of faculty to 1st-year courses</div>
        </div>
        <div className="fyp-actions">
          <input 
            className="fyp-search" 
            placeholder="Search name, cluster, course..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
          <button className="fyp-btn fyp-btn-add" onClick={openAdd}>+ Add Assignment</button>
        </div>
      </div>

      <div className="fyp-table-wrap">
        <table className="fyp-table">
          <thead>
            <tr>
              <th>S. No.</th>
              <th>Academic Year</th>
              <th>Year</th>
              <th>Faculty Name</th>
              <th>Mobile No.</th>
              <th>Cluster</th>
              <th>Workload</th>
              <th>Branch / Section</th>
              <th>Subject Code</th>
              <th>Status</th>
              <th>Created Date</th>
              <th>Updated Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="12" className="fyp-empty-row">No records found.</td>
              </tr>
            ) : filtered.map((item, index) => (
              <tr key={item._id}>
                <td>{index + 1}</td>
                <td>{item.academicYear || '2023-2024'}</td>
                <td>1st Year</td>
                <td>{item.empName}</td>
                <td>{item.mobile || '—'}</td>
                <td>{item.cluster || '—'}</td>
                <td>{item.workloadText}</td>
                <td>
                  {item.branch} {item.sections?.length > 0 ? `(${item.sections.join(', ')})` : ''}
                </td>
                <td>{item.subjectCode}</td>
                <td>{item.allocationStatus || 'Active'}</td>
                <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                <td>{new Date(item.updatedAt).toLocaleDateString()}</td>
                <td>
                  <button className="fyp-edit-btn" onClick={() => openEdit(item)}>Edit</button>
                  <button className="fyp-del-btn" onClick={() => setDeleteItem(item)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fyp-overlay" onClick={() => setShowModal(false)}>
          <div className="fyp-modal" onClick={e => e.stopPropagation()}>
            <div className="fyp-modal-head">
              <h3>{editItem ? 'Edit Assignment' : 'Add Assignment'}</h3>
              <button className="fyp-modal-x" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="fyp-modal-body">
              <div className="fyp-fg">
                <label>Academic Year</label>
                <input value={formData.academicYear} onChange={e => setFormData({...formData, academicYear: e.target.value})} placeholder="e.g. 2023-2024" />
              </div>
              <div className="fyp-fg">
                <label>Faculty *</label>
                <select value={formData.empId} onChange={e => handleFacultyChange(e.target.value)}>
                  <option value="">-- Select Faculty --</option>
                  {facultyMaster.map(f => (
                    <option key={f.empId} value={f.empId}>{f.name} ({f.empId})</option>
                  ))}
                </select>
              </div>
              <div className="fyp-fg">
                <label>Course *</label>
                <select value={formData.subjectCode} onChange={e => setFormData({...formData, subjectCode: e.target.value})}>
                  <option value="">-- Select Course --</option>
                  {coursesMaster.map(c => (
                    <option key={c.subjectCode} value={c.subjectCode}>{c.subjectName} ({c.subjectCode})</option>
                  ))}
                </select>
              </div>
              <div className="fyp-fg">
                <label>Cluster</label>
                <input value={formData.cluster} onChange={e => setFormData({...formData, cluster: e.target.value})} placeholder="e.g. Physics, Mathematics" />
              </div>
              <div className="fyp-fg">
                <label>Branch *</label>
                <input value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})} placeholder="e.g. (CSE-H) or D12" />
              </div>
              <div className="fyp-fg">
                <label>Sections (Comma separated)</label>
                <input value={formData.sections} onChange={e => setFormData({...formData, sections: e.target.value})} placeholder="e.g. 1, 2" />
              </div>
              <div className="fyp-fg">
                <label>Workload *</label>
                <input value={formData.workloadText} onChange={e => setFormData({...formData, workloadText: e.target.value})} placeholder="e.g. 12 or 6 + 8" />
              </div>
              <div className="fyp-fg">
                <label>Status</label>
                <select value={formData.allocationStatus} onChange={e => setFormData({...formData, allocationStatus: e.target.value})}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>
            <div className="fyp-modal-foot">
              <button className="fyp-btn fyp-btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="fyp-btn fyp-btn-save" onClick={saveForm}>Save</button>
            </div>
          </div>
        </div>
      )}

      {deleteItem && (
        <div className="fyp-overlay" onClick={() => setDeleteItem(null)}>
          <div className="fyp-modal" style={{ width: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="fyp-modal-head">
              <h3>Delete Assignment</h3>
            </div>
            <div className="fyp-modal-body">
              Are you sure you want to delete the assignment for {deleteItem.empName}?
            </div>
            <div className="fyp-modal-foot">
              <button className="fyp-btn fyp-btn-cancel" onClick={() => setDeleteItem(null)}>Cancel</button>
              <button className="fyp-btn fyp-btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FirstYearPage;
