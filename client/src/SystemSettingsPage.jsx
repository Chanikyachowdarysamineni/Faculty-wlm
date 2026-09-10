import React, { useState, useEffect, useCallback } from 'react';
import './SystemSettingsPage.css';
import { useSharedData } from './DataContext';
import API from './config';

const SETTING_CATEGORIES = [
  { key: 'years', label: 'Years' },
  { key: 'courseTypes', label: 'Course Types' },
  { key: 'facultyRoles', label: 'Faculty Roles' },
  { key: 'departments', label: 'Departments' },
  { key: 'designations', label: 'Designations' },
];

const SystemSettingsPage = () => {
  const { systemConfig, setSystemConfig } = useSharedData();
  const [activeTab, setActiveTab] = useState('years');
  const [localConfig, setLocalConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  
  const [newInput, setNewInput] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  // Sync local config with global system config
  useEffect(() => {
    if (systemConfig) {
      // Deep copy to allow local mutations
      setLocalConfig(JSON.parse(JSON.stringify(systemConfig)));
    }
  }, [systemConfig]);

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  const handleSaveConfig = async (updatedConfig) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/deva/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(updatedConfig),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSystemConfig(data.data);
        showMessage('Configuration saved successfully!');
      } else {
        throw new Error(data.message || 'Failed to save configuration');
      }
    } catch (err) {
      console.error(err);
      showMessage(err.message, 'error');
      // Revert local changes on failure
      setLocalConfig(JSON.parse(JSON.stringify(systemConfig)));
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    const val = newInput.trim();
    if (!val) return;
    
    const updatedConfig = { ...localConfig };
    if (!updatedConfig[activeTab]) updatedConfig[activeTab] = [];
    
    // Check if it already exists
    if (updatedConfig[activeTab].some(item => item.value.toLowerCase() === val.toLowerCase())) {
      showMessage('Item already exists in this category.', 'error');
      return;
    }

    updatedConfig[activeTab].push({ value: val, isActive: true });
    setNewInput('');
    setLocalConfig(updatedConfig);
    handleSaveConfig(updatedConfig);
  };

  const handleToggleActive = (index) => {
    const updatedConfig = { ...localConfig };
    updatedConfig[activeTab][index].isActive = !updatedConfig[activeTab][index].isActive;
    setLocalConfig(updatedConfig);
    handleSaveConfig(updatedConfig);
  };

  const handleDeleteItem = (index) => {
    if (!window.confirm('Are you sure you want to delete this option?')) return;
    const updatedConfig = { ...localConfig };
    updatedConfig[activeTab].splice(index, 1);
    setLocalConfig(updatedConfig);
    handleSaveConfig(updatedConfig);
  };

  const startEditing = (index, value) => {
    setEditingIndex(index);
    setEditingValue(value);
  };

  const handleSaveEdit = () => {
    const val = editingValue.trim();
    if (!val || editingIndex === null) {
      setEditingIndex(null);
      return;
    }

    const updatedConfig = { ...localConfig };
    
    // Check if new name conflicts
    if (updatedConfig[activeTab].some((item, idx) => idx !== editingIndex && item.value.toLowerCase() === val.toLowerCase())) {
      showMessage('An item with this name already exists.', 'error');
      return;
    }

    updatedConfig[activeTab][editingIndex].value = val;
    setEditingIndex(null);
    setLocalConfig(updatedConfig);
    handleSaveConfig(updatedConfig);
  };

  if (!localConfig) return <div className="settings-loading">Loading system configuration...</div>;

  const currentItems = localConfig[activeTab] || [];

  return (
    <div className="system-settings-page">
      <div className="settings-header">
        <h2>System Configuration</h2>
        <p>Manage dynamic configuration options globally across the application.</p>
      </div>

      {message && (
        <div className={`settings-alert ${messageType}`}>
          {message}
        </div>
      )}

      <div className="settings-layout">
        <div className="settings-tabs">
          {SETTING_CATEGORIES.map(cat => (
            <button
              key={cat.key}
              className={`settings-tab-btn ${activeTab === cat.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(cat.key);
                setEditingIndex(null);
                setNewInput('');
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="settings-content">
          <div className="settings-content-header">
            <h3>Manage {SETTING_CATEGORIES.find(c => c.key === activeTab)?.label}</h3>
          </div>

          <div className="add-item-bar">
            <input
              type="text"
              placeholder={`Add new ${SETTING_CATEGORIES.find(c => c.key === activeTab)?.label.slice(0, -1).toLowerCase()}...`}
              value={newInput}
              onChange={(e) => setNewInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              disabled={loading}
            />
            <button className="btn-add" onClick={handleAddItem} disabled={loading || !newInput.trim()}>
              Add
            </button>
          </div>

          <div className="items-list">
            {currentItems.length === 0 ? (
              <div className="no-items">No items configured for this category.</div>
            ) : (
              currentItems.map((item, index) => (
                <div key={index} className={`item-row ${!item.isActive ? 'inactive' : ''}`}>
                  <div className="item-info">
                    {editingIndex === index ? (
                      <input
                        autoFocus
                        className="edit-input"
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') setEditingIndex(null);
                        }}
                      />
                    ) : (
                      <span className="item-name">{item.value}</span>
                    )}
                    
                    {!item.isActive && <span className="badge-inactive">Disabled</span>}
                  </div>
                  
                  <div className="item-actions">
                    {editingIndex === index ? (
                      <>
                        <button className="btn-icon save" onClick={handleSaveEdit} title="Save" disabled={loading}>
                          ✓
                        </button>
                        <button className="btn-icon cancel" onClick={() => setEditingIndex(null)} title="Cancel" disabled={loading}>
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          className={`btn-toggle ${item.isActive ? 'active' : 'inactive'}`} 
                          onClick={() => handleToggleActive(index)}
                          disabled={loading}
                        >
                          {item.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button className="btn-icon edit" onClick={() => startEditing(index, item.value)} title="Edit" disabled={loading}>
                          ✎
                        </button>
                        <button className="btn-icon delete" onClick={() => handleDeleteItem(index)} title="Delete" disabled={loading}>
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettingsPage;
