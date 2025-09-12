import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, Edit, Trash2, Plus, RotateCcw } from "lucide-react";
import { AddTopicModal } from '@/components/AddTopicModal';

interface Topic {
  slug: string;
  name: string;
  enabled: boolean;
  last_run?: string;
  items_count: number;
  runs_count: number;
}

export function TopicsListSimple() {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [revertTopicSlug, setRevertTopicSlug] = useState('');
  const [deleteTopicSlug, setDeleteTopicSlug] = useState('');
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    try {
      console.log('Fetching topics from API...');
      const response = await fetch('http://localhost:8000/topics');
      console.log('Response:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Topics data received:', data);
        setTopics(data);
      } else {
        console.error('API returned error:', response.status);
      }
    } catch (error) {
      console.error('Error fetching topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessTopic = async (slug: string) => {
    console.log('Processing topic:', slug);
    try {
      const response = await fetch(`http://localhost:8000/topics/${slug}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer your-secure-api-key-minimum-32-chars`,
        },
        body: JSON.stringify({ force: false }),
      });
      
      console.log('Process response:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Process result:', result);
        // Navigate to runs page to show the processing status
        navigate('/runs');
      } else {
        const error = await response.text();
        console.error('Process error:', error);
        alert("Failed to start processing: " + response.status);
      }
    } catch (error) {
      console.error('Process exception:', error);
      alert("Error starting process: " + error.message);
    }
  };

  const handleAddTopic = () => {
    console.log('Add topic clicked');
    setEditingTopic(null); // Reset editing state for new topic
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingTopic(null); // Reset editing state
  };

  const handleTopicAdded = () => {
    console.log('Topic added, refreshing list...');
    fetchTopics(); // Refresh the topics list
  };

  const handleEditTopic = (slug: string) => {
    console.log('Edit topic clicked:', slug);
    const topic = topics.find(t => t.slug === slug);
    if (topic) {
      setEditingTopic(topic);
      setShowAddModal(true);
    }
  };

  const handleDeleteTopic = (slug: string) => {
    console.log('Delete topic clicked:', slug);
    setDeleteTopicSlug(slug);
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    console.log('Starting delete process for:', deleteTopicSlug);
    try {
      const response = await fetch(`http://localhost:8000/topics/${deleteTopicSlug}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer your-secure-api-key-minimum-32-chars`,
        },
      });
      
      console.log('Delete response:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Delete result:', result);
        alert(`Topic "${deleteTopicSlug}" deleted successfully!`);
        fetchTopics(); // Refresh the topics list
      } else {
        const error = await response.text();
        console.error('Delete error:', error);
        alert(`Failed to delete topic: ${response.status}`);
      }
    } catch (error) {
      console.error('Delete exception:', error);
      alert(`Error deleting topic: ${error.message}`);
    }
    
    setShowDeleteModal(false);
    setDeleteTopicSlug('');
  };

  const handleRevertTopic = (slug: string) => {
    console.log('Revert topic clicked:', slug);
    setRevertTopicSlug(slug);
    setShowRevertModal(true);
  };

  const executeRevert = async (period: string) => {
    console.log('Executing revert for:', revertTopicSlug, 'period:', period);
    
    try {
      const response = await fetch(`http://localhost:8000/topics/${revertTopicSlug}/revert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer your-secure-api-key-minimum-32-chars`,
        },
        body: JSON.stringify({ period }),
      });
      
      console.log('Revert response:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Revert result:', result);
        alert(`Topic reverted successfully for period ${period}!`);
        fetchTopics(); // Refresh the list
      } else {
        const error = await response.text();
        console.error('Revert error:', error);
        alert("Failed to revert topic: " + response.status);
      }
    } catch (error) {
      console.error('Revert exception:', error);
      alert("Error reverting topic: " + error.message);
    }
    
    setShowRevertModal(false);
    setRevertTopicSlug('');
  };

  if (loading) {
    return <div className="loading">Loading topics...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>Topics</h1>
          <p className="subtitle">
            Manage your news monitoring topics and run processing jobs.
          </p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={handleAddTopic}>
            <Plus className="icon-sm" />
            Add Topic
          </button>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Last Run</th>
              <th>Items</th>
              <th>Total Runs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((topic) => (
              <tr key={topic.slug}>
                <td>
                  <div>
                    <div className="font-medium text-gray-900">
                      <Link to={`/topics/${topic.slug}`} className="topic-name-link">
                        {topic.name}
                      </Link>
                    </div>
                    <div className="text-sm text-gray-500">{topic.slug}</div>
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${topic.enabled ? 'status-enabled' : 'status-disabled'}`}>
                    {topic.enabled ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td className="text-sm text-gray-900">
                  {topic.last_run
                    ? new Date(topic.last_run).toLocaleString()
                    : "Never"}
                </td>
                <td className="text-sm text-gray-900">
                  {topic.items_count}
                </td>
                <td className="text-sm text-gray-900">
                  {topic.runs_count}
                </td>
                <td>
                  <div className="actions">
                    <button
                      onClick={() => handleProcessTopic(topic.slug)}
                      disabled={!topic.enabled}
                      className="btn btn-sm btn-primary"
                    >
                      <Play className="icon-sm" />
                      Run
                    </button>
                    <button 
                      className="btn btn-sm" 
                      style={{backgroundColor: '#fef3c7', color: '#d97706'}}
                      onClick={() => handleRevertTopic(topic.slug)}
                    >
                      <RotateCcw className="icon-sm" />
                      Revert
                    </button>
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleEditTopic(topic.slug)}
                    >
                      <Edit className="icon-sm" />
                      Edit
                    </button>
                    <button 
                      className="btn btn-sm" 
                      style={{backgroundColor: '#fee', color: '#b91c1c'}}
                      onClick={() => handleDeleteTopic(topic.slug)}
                    >
                      <Trash2 className="icon-sm" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {topics.length === 0 && (
          <div className="empty-state">
            <p>No topics found</p>
          </div>
        )}
      </div>

      <AddTopicModal 
        isOpen={showAddModal}
        onClose={handleCloseModal}
        onTopicAdded={handleTopicAdded}
        editingTopic={editingTopic}
      />

      {/* Revert Modal */}
      {showRevertModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowRevertModal(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              minWidth: '400px',
              maxWidth: '500px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>Revert Topic: {revertTopicSlug}</h2>
              <button 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '24px', 
                  cursor: 'pointer',
                  color: '#666'
                }} 
                onClick={() => setShowRevertModal(false)}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ marginBottom: '16px', color: '#666' }}>
                Enter the time period to revert. This will delete runs and items from the specified time period.
              </p>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Time Period:</label>
                <input 
                  type="text" 
                  id="revertPeriod"
                  placeholder="e.g., 1d, 3h, 30m"
                  defaultValue="1d"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                    marginBottom: '8px'
                  }}
                />
                <small style={{ color: '#666', fontSize: '12px' }}>
                  Examples: 30m (30 minutes), 2h (2 hours), 1d (1 day), 7d (7 days)
                </small>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
                onClick={() => setShowRevertModal(false)}
              >
                Cancel
              </button>
              <button 
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#d97706',
                  color: 'white',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  const period = (document.getElementById('revertPeriod') as HTMLInputElement)?.value;
                  if (period && /^\d+[dhm]$/.test(period)) {
                    executeRevert(period);
                  } else {
                    alert("Invalid period format. Please use format like '1d', '3h', or '30m'");
                  }
                }}
              >
                Revert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              minWidth: '400px',
              maxWidth: '500px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>Delete Topic: {deleteTopicSlug}</h2>
              <button 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '24px', 
                  cursor: 'pointer',
                  color: '#666'
                }} 
                onClick={() => setShowDeleteModal(false)}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ marginBottom: '16px', color: '#666' }}>
                Are you sure you want to delete topic "{deleteTopicSlug}"?
              </p>
              <p style={{ marginBottom: '16px', color: '#d97706', fontWeight: '600' }}>
                ⚠️ This action cannot be undone and will permanently delete:
              </p>
              <ul style={{ color: '#666', marginLeft: '20px', marginBottom: '0' }}>
                <li>The topic configuration</li>
                <li>All runs and execution history</li>
                <li>All collected items and sources</li>
                <li>All associated data</li>
              </ul>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button 
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  cursor: 'pointer'
                }}
                onClick={executeDelete}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}