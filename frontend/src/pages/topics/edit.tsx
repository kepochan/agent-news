import { useForm } from "@refinedev/react-hook-form";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function TopicsEdit() {
  const { slug } = useParams<{ slug: string }>();
  
  const {
    refineCore: { onFinish, formLoading },
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resource: "topics",
    action: "edit",
    id: slug!,
  });

  return (
    <div>
      <div className="mb-6">
        <Link
          to={`/topics/${slug}`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Topic
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Edit Topic</h1>
        </div>

        <form onSubmit={handleSubmit(onFinish)} className="px-6 py-4 space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              id="name"
              {...register("name", { required: "Name is required" })}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
              Slug
            </label>
            <input
              type="text"
              id="slug"
              {...register("slug", { required: "Slug is required" })}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
            {errors.slug && (
              <p className="mt-1 text-sm text-red-600">{errors.slug.message}</p>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              {...register("enabled")}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">
              Enabled
            </label>
          </div>

          <div>
            <label htmlFor="lookbackDays" className="block text-sm font-medium text-gray-700">
              Lookback Days
            </label>
            <input
              type="number"
              id="lookbackDays"
              {...register("lookbackDays", { 
                required: "Lookback days is required",
                min: { value: 1, message: "Must be at least 1 day" }
              })}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
            {errors.lookbackDays && (
              <p className="mt-1 text-sm text-red-600">{errors.lookbackDays.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Link
              to={`/topics/${slug}`}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={formLoading}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {formLoading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}