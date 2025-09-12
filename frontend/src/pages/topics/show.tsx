import { useShow, useList } from "@refinedev/core";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Edit, Calendar, Activity, MessageSquare } from "lucide-react";

interface Run {
  id: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  items_count: number;
  error?: string;
  openai_response?: string;
}

export function TopicsShow() {
  const { slug } = useParams<{ slug: string }>();
  
  const { data: topic, isLoading: topicLoading } = useShow({
    resource: "topics",
    id: slug!,
  });

  const { data: runs, isLoading: runsLoading } = useList<Run>({
    resource: "runs",
    filters: [{ field: "topic_slug", operator: "eq", value: slug }],
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { pageSize: 10 },
  });

  if (topicLoading || runsLoading) {
    return <div>Loading...</div>;
  }

  const topicData = topic?.data;

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/topics"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Topics
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{topicData?.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{topicData?.slug}</p>
            </div>
            <div className="flex space-x-3">
              <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                <Play className="w-4 h-4 mr-2" />
                Run Processing
              </button>
              <Link
                to={`/topics/${slug}/edit`}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Link>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Activity className="w-5 h-5 text-gray-600 mr-2" />
                <span className="text-sm font-medium text-gray-900">Status</span>
              </div>
              <p className="mt-1">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    topicData?.enabled
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {topicData?.enabled ? "Enabled" : "Disabled"}
                </span>
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Calendar className="w-5 h-5 text-gray-600 mr-2" />
                <span className="text-sm font-medium text-gray-900">Last Run</span>
              </div>
              <p className="mt-1 text-sm text-gray-700">
                {topicData?.last_run
                  ? new Date(topicData.last_run).toLocaleString()
                  : "Never"}
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center">
                <MessageSquare className="w-5 h-5 text-gray-600 mr-2" />
                <span className="text-sm font-medium text-gray-900">Total Items</span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{topicData?.items_count || 0}</p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Runs</h2>
            
            {runs?.data && runs.data.length > 0 ? (
              <div className="space-y-4">
                {runs.data.map((run) => (
                  <div
                    key={run.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              run.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : run.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : run.status === "running"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {run.status}
                          </span>
                          <span className="text-sm text-gray-500">
                            {run.items_count} items
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(run.created_at).toLocaleString()}
                          </span>
                        </div>
                        
                        {run.error && (
                          <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                            {run.error}
                          </div>
                        )}

                        {run.openai_response && (
                          <div className="mt-3">
                            <h4 className="text-sm font-medium text-gray-900">OpenAI Response:</h4>
                            <div className="mt-1 text-sm text-gray-700 bg-blue-50 p-3 rounded">
                              {run.openai_response}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <Link
                        to={`/runs/${run.id}`}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No runs yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}