import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout";
import { AuthProvider } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TopicsListSimple } from "@/pages/topics/list-simple";
import { RunsListSimple } from "@/pages/runs/list-simple";
import { TopicDetail } from "@/pages/topics/detail";
import { TopicCreate } from "@/pages/topics/create";
import { TopicEdit } from "@/pages/topics/edit";
import { MembersList } from "@/pages/members/list";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={
              <ProtectedRoute>
                <TopicsListSimple />
              </ProtectedRoute>
            } />
            <Route path="/topics" element={
              <ProtectedRoute>
                <TopicsListSimple />
              </ProtectedRoute>
            } />
            <Route path="/topics/create" element={
              <ProtectedRoute>
                <TopicCreate />
              </ProtectedRoute>
            } />
            <Route path="/topics/:slug/edit" element={
              <ProtectedRoute>
                <TopicEdit />
              </ProtectedRoute>
            } />
            <Route path="/topics/:slug" element={
              <ProtectedRoute>
                <TopicDetail />
              </ProtectedRoute>
            } />
            <Route path="/runs" element={
              <ProtectedRoute>
                <RunsListSimple />
              </ProtectedRoute>
            } />
            <Route path="/members" element={
              <ProtectedRoute requireAdmin>
                <MembersList />
              </ProtectedRoute>
            } />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;