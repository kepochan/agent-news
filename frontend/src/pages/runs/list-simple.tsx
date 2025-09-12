import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { useGeneralSSE } from '@/hooks/useSSE';

interface Run {
  id: string;
  topic_slug: string;
  topic_name: string;
  status: string;
  items_count: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export function RunsListSimple() {
  const navigate = useNavigate();
  const { lastEvent, isConnected } = useGeneralSSE();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    fetchRuns();
  }, []);

  // Handle SSE events for real-time run updates
  useEffect(() => {
    if (!lastEvent) return;

    console.log('SSE Event received on runs page:', lastEvent);

    if (lastEvent.type === 'new-run') {
      // Add new run to the list
      fetchRuns();
    }

    if (lastEvent.type === 'run-update') {
      // Update existing run status
      console.log('Processing run-update event:', lastEvent.data);
      setRuns(prevRuns => 
        prevRuns.map(run => 
          run.id === lastEvent.data.runId 
            ? { ...run, status: lastEvent.data.status, ...lastEvent.data }
            : run
        )
      );
      
      // If run is completed, fetch full details
      if (lastEvent.data.status === 'completed' || lastEvent.data.status === 'failed') {
        setTimeout(() => fetchRuns(), 1000); // Small delay to ensure data is saved
      }
    }
  }, [lastEvent]);

  const fetchRuns = async () => {
    try {
      console.log('Fetching runs from API...');
      const response = await fetch('http://localhost:8000/runs?limit=50');
      console.log('Runs response:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Runs data received:', data);
        // Force new array to trigger React re-render
        setRuns([...data]);
        setRefreshCounter(prev => prev + 1);
      } else {
        console.error('API returned error:', response.status);
      }
    } catch (error) {
      console.error('Error fetching runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="icon" style={{color: '#059669'}} />;
      case "failed":
        return <XCircle className="icon" style={{color: '#dc2626'}} />;
      case "running":
        return <Clock className="icon" style={{color: '#d97706'}} />;
      case "pending":
        return <AlertCircle className="icon" style={{color: '#6b7280'}} />;
      default:
        return <AlertCircle className="icon" style={{color: '#6b7280'}} />;
    }
  };

  const formatDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt || !completedAt) return "-";
    
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const duration = end.getTime() - start.getTime();
    
    if (duration < 1000) return "< 1s";
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    if (duration < 3600000) return `${Math.round(duration / 60000)}m`;
    
    return `${Math.round(duration / 3600000)}h`;
  };

  const handleViewRun = (run: Run) => {
    // Navigate to topic page with run ID as anchor/scroll target
    navigate(`/topics/${run.topic_slug}#run-${run.id}`);
  };

  if (loading) {
    return <div className="loading">Loading runs...</div>;
  }

  const runningRuns = runs.filter(run => run.status === "running");

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1>Runs History</h1>
          </div>
          <p className="subtitle">
            View all processing runs with their results, logs, and OpenAI responses.
          </p>
        </div>
      </div>

      {/* Currently Running Section */}
      {runningRuns.length > 0 && (
        <div className="running-section" style={{ marginBottom: '2rem' }}>
          <h2>Currently Running</h2>
          {runningRuns.map((run) => (
            <div key={run.id} className="running-item">
              <div className="flex items-center">
                <Clock className="icon" style={{color: '#d97706'}} />
                <span className="font-medium">{run.topic_name}</span>
                <span className="text-sm text-gray-500" style={{marginLeft: '0.5rem'}}>
                  Started {run.started_at ? new Date(run.started_at).toLocaleString() : 'recently'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Topic</th>
              <th>Status</th>
              <th>Items</th>
              <th>Duration</th>
              <th>Started At</th>
              <th>Completed At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run, index) => (
              <tr key={`${run.id}-${run.status}-${refreshCounter}-${index}`}>
                <td>
                  <div>
                    <div className="font-medium text-gray-900">
                      {run.topic_name}
                    </div>
                    <div className="text-sm text-gray-500">{run.topic_slug}</div>
                  </div>
                </td>
                <td>
                  <div className="flex items-center">
                    {getStatusIcon(run.status)}
                    <span className={`status-badge status-${run.status}`}>
                      {run.status}
                    </span>
                  </div>
                </td>
                <td className="text-sm text-gray-900">
                  {run.items_count}
                </td>
                <td className="text-sm text-gray-900">
                  {formatDuration(run.started_at, run.completed_at)}
                </td>
                <td className="text-sm text-gray-900">
                  {run.started_at
                    ? new Date(run.started_at).toLocaleString()
                    : "-"}
                </td>
                <td className="text-sm text-gray-900">
                  {run.completed_at
                    ? new Date(run.completed_at).toLocaleString()
                    : "-"}
                </td>
                <td>
                  <div className="actions">
                    {run.status !== 'running' && (
                      <button
                        onClick={() => handleViewRun(run)}
                        className="btn btn-sm btn-primary"
                      >
                        <Eye className="icon-sm" />
                        View
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {runs.length === 0 && (
          <div className="empty-state">
            <p>No runs found</p>
          </div>
        )}
      </div>
    </div>
  );
}