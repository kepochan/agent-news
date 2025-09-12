import { useShow } from "@refinedev/core";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle, ExternalLink, MessageSquare, FileText } from "lucide-react";

interface RunDetails {
  id: string;
  topic_slug: string;
  topic_name: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  metadata?: any;
  items: Array<{
    id: string;
    title: string;
    url?: string;
    published_at?: string;
    source_name: string;
    source_type: string;
    processed: boolean;
    summary?: string;
    slack_message_id?: string;
    error?: string;
  }>;
  openai_summary?: string;
}

export function RunsShow() {
  const { id } = useParams<{ id: string }>();
  
  const { data: run, isLoading } = useShow<RunDetails>({
    resource: "runs",
    id: id!,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "running":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "pending":
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const runData = run?.data;
  if (!runData) {
    return <div>Run not found</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/runs"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Runs
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-3">
                {getStatusIcon(runData.status)}
                <h1 className="text-2xl font-bold text-gray-900">
                  Run Details
                </h1>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Topic: <Link to={`/topics/${runData.topic_slug}`} className="text-indigo-600 hover:text-indigo-900">{runData.topic_name}</Link>
              </p>
            </div>
            <span
              className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                runData.status === "completed"
                  ? "bg-green-100 text-green-800"
                  : runData.status === "failed"
                  ? "bg-red-100 text-red-800"
                  : runData.status === "running"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {runData.status}
            </span>
          </div>
        </div>

        <div className="px-6 py-4">
          {/* Run Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-900">Created</div>
              <div className="mt-1 text-sm text-gray-700">
                {new Date(runData.created_at).toLocaleString()}
              </div>
            </div>
            
            {runData.started_at && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-900">Started</div>
                <div className="mt-1 text-sm text-gray-700">
                  {new Date(runData.started_at).toLocaleString()}
                </div>
              </div>
            )}
            
            {runData.completed_at && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-900">Completed</div>
                <div className="mt-1 text-sm text-gray-700">
                  {new Date(runData.completed_at).toLocaleString()}
                </div>
              </div>
            )}
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-900">Items Processed</div>
              <div className="mt-1 text-sm text-gray-700">
                {runData.items?.length || 0}
              </div>
            </div>
          </div>

          {/* Error Section */}
          {runData.error && (
            <div className="mb-8">
              <h2 className="text-lg font-medium text-gray-900 mb-3">Error</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <XCircle className="w-5 h-5 text-red-400 mr-3 mt-0.5" />
                  <div className="text-sm text-red-700">{runData.error}</div>
                </div>
              </div>
            </div>
          )}

          {/* OpenAI Summary */}
          {runData.openai_summary && (
            <div className="mb-8">
              <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                OpenAI Summary
              </h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {runData.openai_summary}
                </div>
              </div>
            </div>
          )}

          {/* Logs Section */}
          {runData.metadata?.logs && (
            <div className="mb-8">
              <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Execution Logs
              </h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                  {runData.metadata.logs}
                </pre>
              </div>
            </div>
          )}

          {/* Items Section */}
          {runData.items && runData.items.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Processed Items</h2>
              <div className="space-y-4">
                {runData.items.map((item) => (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-4 ${
                      item.processed ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-sm font-medium text-gray-900">
                            {item.title}
                          </h3>
                          {item.processed ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                          <span>{item.source_name} ({item.source_type})</span>
                          {item.published_at && (
                            <span>{new Date(item.published_at).toLocaleString()}</span>
                          )}
                        </div>
                        
                        {item.summary && (
                          <div className="mt-3 p-3 bg-white rounded border">
                            <h4 className="text-xs font-medium text-gray-900 mb-1">Summary:</h4>
                            <p className="text-sm text-gray-700">{item.summary}</p>
                          </div>
                        )}
                        
                        {item.error && (
                          <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-700">
                            Error: {item.error}
                          </div>
                        )}
                        
                        {item.slack_message_id && (
                          <div className="mt-2 text-xs text-gray-500">
                            Slack Message: {item.slack_message_id}
                          </div>
                        )}
                      </div>
                      
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-4 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-900"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}