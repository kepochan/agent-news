import { useState, useEffect } from 'react';
import { Eye, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";

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
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRuns();
  }, []);

  const fetchRuns = async () => {
    try {
      console.log('Fetching runs from API...');
      const response = await fetch('http://localhost:8000/runs?limit=50');
      console.log('Runs response:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Runs data received:', data);
        setRuns(data);
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

  const handleViewRun = (runId: string) => {
    console.log('View run clicked:', runId);
    alert(`View Run Details: ${runId} - TODO: Implement run details page`);
  };

  if (loading) {
    return <div className="loading">Loading runs...</div>;
  }

  const runningRuns = runs.filter(run => run.status === "running");

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>Runs History</h1>
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
              <button
                onClick={() => handleViewRun(run.id)}
                className="text-sm"
                style={{color: '#4f46e5'}}
              >
                View Details
              </button>
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
            {runs.map((run) => (
              <tr key={run.id}>
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
                    <button
                      onClick={() => handleViewRun(run.id)}
                      className="btn btn-sm btn-primary"
                    >
                      <Eye className="icon-sm" />
                      View
                    </button>
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