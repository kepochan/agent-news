import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTopicSSE } from '@/hooks/useSSE';
import { Play, Edit, Trash2, RotateCcw, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { AddTopicModal } from '@/components/AddTopicModal';

interface Topic {
  slug: string;
  name: string;
  enabled: boolean;
  last_run?: string;
  items_count: number;
  runs_count: number;
  sources?: any[];
  channels?: { slack?: { channels: string[]; }; };
  assistantId?: string;
}

interface RunItem {
  id: string;
  title: string;
  url: string;
  published_at: string;
  source_name: string;
  source_type: string;
  processed: boolean;
  summary?: string;
  slack_message_id?: string;
  error?: string;
}

interface Run {
  id: string;
  topic_slug: string;
  topic_name: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  metadata?: any;
  items?: RunItem[];
  openai_prompt?: string;
  openai_response?: string;
  logs?: string;
  openai_summary?: string;
}

export function TopicDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { lastEvent, isConnected } = useTopicSSE(slug || '');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchTopicDetails();
      fetchTopicRuns();
    }
  }, [slug]);

  // Handle SSE events
  useEffect(() => {
    if (!lastEvent) return;

    console.log('SSE Event received:', lastEvent);

    if (lastEvent.type === 'new-run' && lastEvent.data.run.topicSlug === slug) {
      // Add new run to the list
      fetchTopicRuns();
    }

    if (lastEvent.type === 'run-update' && lastEvent.data.topicSlug === slug) {
      // Update existing run status
      setRuns(prevRuns => 
        prevRuns.map(run => 
          run.id === lastEvent.data.runId 
            ? { ...run, status: lastEvent.data.status, ...lastEvent.data }
            : run
        )
      );
      
      // If run is completed, fetch full details
      if (lastEvent.data.status === 'completed' || lastEvent.data.status === 'failed') {
        setTimeout(() => fetchTopicRuns(), 1000); // Small delay to ensure data is saved
      }
    }

    if (lastEvent.type === 'runs-update' && lastEvent.data.topicSlug === slug) {
      // Full runs update
      fetchTopicRuns();
    }
  }, [lastEvent, slug]);

  const fetchTopicDetails = async () => {
    try {
      const response = await fetch(`http://localhost:8000/topics/${slug}`);
      if (response.ok) {
        const data = await response.json();
        setTopic(data);
      } else {
        console.error('Failed to fetch topic details:', response.status);
      }
    } catch (error) {
      console.error('Error fetching topic details:', error);
    }
  };

  const fetchTopicRuns = async () => {
    try {
      // First get the basic runs list
      const response = await fetch(`http://localhost:8000/runs?topic_slug=${slug}`);
      if (response.ok) {
        const basicRuns = await response.json();
        
        // Then fetch detailed data for each run
        const detailedRuns = await Promise.all(
          basicRuns.map(async (run: any) => {
            try {
              const detailResponse = await fetch(`http://localhost:8000/runs/${run.id}`);
              if (detailResponse.ok) {
                const detailData = await detailResponse.json();
                console.log(`Run ${run.id} detail data:`, detailData);
                return detailData;
              } else {
                console.error(`Failed to fetch details for run ${run.id}`);
                return run; // Return basic run if detail fetch fails
              }
            } catch (error) {
              console.error(`Error fetching details for run ${run.id}:`, error);
              return run; // Return basic run if detail fetch fails
            }
          })
        );
        
        setRuns(detailedRuns);
      } else {
        console.error('Failed to fetch runs:', response.status);
      }
    } catch (error) {
      console.error('Error fetching runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRunExpanded = (runId: string) => {
    const newExpanded = new Set(expandedRuns);
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId);
    } else {
      newExpanded.add(runId);
    }
    setExpandedRuns(newExpanded);
  };

  const togglePromptExpanded = (runId: string) => {
    const newExpanded = new Set(expandedPrompts);
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId);
    } else {
      newExpanded.add(runId);
    }
    setExpandedPrompts(newExpanded);
  };

  const handleProcessTopic = async () => {
    if (!topic || !slug) return;
    
    try {
      const response = await fetch(`http://localhost:8000/topics/${slug}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer your-secure-api-key-minimum-32-chars`,
        },
        body: JSON.stringify({ force: false }),
      });
      
      if (response.ok) {
        // Navigate to runs page to show the processing status
        navigate('/runs');
      } else {
        alert("Failed to start processing: " + response.status);
      }
    } catch (error) {
      console.error('Process exception:', error);
      alert("Error starting process: " + (error as Error).message);
    }
  };

  const handleEditTopic = () => {
    setShowAddModal(true);
  };

  const handleRevertTopic = () => {
    setShowRevertModal(true);
  };

  const handleDeleteTopic = () => {
    setShowDeleteModal(true);
  };

  const executeRevert = async (period: string) => {
    if (!slug) return;
    
    try {
      const response = await fetch(`http://localhost:8000/topics/${slug}/revert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer your-secure-api-key-minimum-32-chars`,
        },
        body: JSON.stringify({ period }),
      });
      
      if (response.ok) {
        alert(`Topic reverted successfully for period ${period}!`);
        fetchTopicRuns(); // Refresh runs
      } else {
        alert("Failed to revert topic: " + response.status);
      }
    } catch (error) {
      console.error('Revert exception:', error);
      alert("Error reverting topic: " + (error as Error).message);
    }
    
    setShowRevertModal(false);
  };

  const executeDelete = async () => {
    if (!slug) return;
    
    try {
      const response = await fetch(`http://localhost:8000/topics/${slug}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer your-secure-api-key-minimum-32-chars`,
        },
      });
      
      if (response.ok) {
        alert(`Topic "${slug}" deleted successfully!`);
        // Navigate back to topics list
        window.location.href = '/topics';
      } else {
        alert(`Failed to delete topic: ${response.status}`);
      }
    } catch (error) {
      console.error('Delete exception:', error);
      alert(`Error deleting topic: ${(error as Error).message}`);
    }
    
    setShowDeleteModal(false);
  };

  const handleTopicUpdated = () => {
    fetchTopicDetails();
    fetchTopicRuns();
  };

  if (loading) {
    return <div className="loading">Loading topic details...</div>;
  }

  if (!topic) {
    return <div className="error">Topic not found</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/topics" className="btn btn-secondary">
            <ArrowLeft className="icon-sm" />
            Back to Topics
          </Link>
          <div>
            <h1>{topic.name}</h1>
            <p className="subtitle" style={{ marginBottom: '0.5rem' }}>
              {topic.slug} • {runs.length} runs • {topic.items_count} items total
            </p>
            <span className={`status-badge ${topic.enabled ? 'status-enabled' : 'status-disabled'}`}>
              {topic.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleProcessTopic}
            disabled={!topic.enabled}
            className="btn btn-primary"
          >
            <Play className="icon-sm" />
            Run
          </button>
          <button 
            className="btn" 
            style={{backgroundColor: '#fef3c7', color: '#d97706'}}
            onClick={handleRevertTopic}
          >
            <RotateCcw className="icon-sm" />
            Revert
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handleEditTopic}
          >
            <Edit className="icon-sm" />
            Edit
          </button>
          <button 
            className="btn" 
            style={{backgroundColor: '#fee', color: '#b91c1c'}}
            onClick={handleDeleteTopic}
          >
            <Trash2 className="icon-sm" />
            Delete
          </button>
        </div>
      </div>

      {/* Runs List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {runs.length === 0 ? (
          <div className="empty-state">
            <p>No runs found for this topic</p>
          </div>
        ) : (
          runs.map((run) => (
            <div key={run.id} className="run-post">
              <div className="run-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
                      Run from {new Date(run.created_at).toLocaleString()}
                    </h3>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.9rem', color: '#666' }}>
                      <span className={`status-badge ${run.status === 'completed' ? 'status-enabled' : run.status === 'failed' ? 'status-error' : 'status-disabled'}`}>
                        {run.status}
                      </span>
                      {run.items && (
                        <span>{run.items.length} items processed</span>
                      )}
                      {run.completed_at && (
                        <span>Completed: {new Date(run.completed_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleRunExpanded(run.id)}
                    className="btn btn-sm btn-secondary"
                    style={{ minWidth: 'auto' }}
                  >
                    {expandedRuns.has(run.id) ? (
                      <ChevronUp className="icon-sm" />
                    ) : (
                      <ChevronDown className="icon-sm" />
                    )}
                  </button>
                </div>
              </div>

              {/* OpenAI Summary/Response */}
              <div className="run-content" style={{ marginTop: '1rem' }}>
                {run.openai_summary && (
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#333' }}>OpenAI Summary:</h4>
                    <div style={{ 
                      backgroundColor: '#f8f9fa', 
                      padding: '1rem', 
                      borderRadius: '6px',
                      borderLeft: '4px solid #0066cc',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.5'
                    }}>
                      {run.openai_summary}
                    </div>
                  </div>
                )}
                
                {run.openai_response && !run.openai_summary && (
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#333' }}>OpenAI Response:</h4>
                    <div style={{ 
                      backgroundColor: '#f8f9fa', 
                      padding: '1rem', 
                      borderRadius: '6px',
                      borderLeft: '4px solid #0066cc',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.5'
                    }}>
                      {run.openai_response}
                    </div>
                  </div>
                )}

                {/* Show message if no OpenAI data is available */}
                {!run.openai_summary && !run.openai_response && !run.error && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ 
                      backgroundColor: '#f3f4f6', 
                      padding: '1rem', 
                      borderRadius: '6px',
                      borderLeft: '4px solid #9ca3af',
                      color: '#6b7280',
                      fontStyle: 'italic'
                    }}>
                      No OpenAI summary available for this run.
                    </div>
                  </div>
                )}

                {/* OpenAI Prompt Section - Collapsible */}
                {run.openai_prompt && (
                  <div style={{ marginBottom: '1rem' }}>
                    <button
                      onClick={() => togglePromptExpanded(run.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#666',
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0',
                        fontWeight: '500'
                      }}
                    >
                      {expandedPrompts.has(run.id) ? (
                        <ChevronUp className="icon-sm" />
                      ) : (
                        <ChevronDown className="icon-sm" />
                      )}
                      Show OpenAI Prompt
                    </button>
                    
                    {expandedPrompts.has(run.id) && (
                      <div style={{ 
                        backgroundColor: '#f8f9fa', 
                        padding: '1rem', 
                        borderRadius: '6px',
                        borderLeft: '3px solid #666',
                        fontSize: '0.9rem',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '300px',
                        overflow: 'auto',
                        fontFamily: 'monospace',
                        lineHeight: '1.4',
                        color: '#333'
                      }}>
                        {run.openai_prompt}
                      </div>
                    )}
                  </div>
                )}

                {run.error && (
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#dc2626' }}>Error:</h4>
                    <div style={{ 
                      backgroundColor: '#fef2f2', 
                      padding: '1rem', 
                      borderRadius: '6px',
                      borderLeft: '4px solid #dc2626',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.5',
                      color: '#dc2626'
                    }}>
                      {run.error}
                    </div>
                  </div>
                )}
              </div>

              {/* Expandable Fetcher Data Section */}
              {expandedRuns.has(run.id) && (
                <div className="run-details" style={{ 
                  marginTop: '1rem', 
                  paddingTop: '1rem', 
                  borderTop: '1px solid #e5e5e5' 
                }}>
                  {run.items && run.items.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#666' }}>
                        Fetcher Data ({run.items.length} items):
                      </h4>
                      <div style={{ 
                        backgroundColor: '#f9f9f9', 
                        padding: '0.75rem', 
                        borderRadius: '4px',
                        maxHeight: '400px',
                        overflow: 'auto'
                      }}>
                        {run.items.map((item, index) => (
                          <div key={item.id} style={{ 
                            marginBottom: index < run.items!.length - 1 ? '0.75rem' : '0',
                            paddingBottom: index < run.items!.length - 1 ? '0.75rem' : '0',
                            borderBottom: index < run.items!.length - 1 ? '1px solid #e5e5e5' : 'none'
                          }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                              {item.title}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>
                              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>
                                {item.url}
                              </a>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#888' }}>
                              {item.source_name} • {new Date(item.published_at).toLocaleString()} • 
                              <span style={{ color: item.processed ? '#059669' : '#dc2626', fontWeight: '500' }}>
                                {item.processed ? ' Processed' : ' Not Processed'}
                              </span>
                            </div>
                            {item.summary && (
                              <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: '#444' }}>
                                Summary: {item.summary}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {run.logs && (
                    <div>
                      <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#666' }}>Logs:</h4>
                      <div style={{ 
                        backgroundColor: '#1a1a1a', 
                        color: '#f5f5f5',
                        padding: '0.75rem', 
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '300px',
                        overflow: 'auto'
                      }}>
                        {run.logs}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <AddTopicModal 
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onTopicAdded={handleTopicUpdated}
        editingTopic={topic}
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
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>Revert Topic: {slug}</h2>
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
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>Delete Topic: {slug}</h2>
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
                Are you sure you want to delete topic "{slug}"?
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