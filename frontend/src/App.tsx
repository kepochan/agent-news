import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout";
import { TopicsListSimple } from "@/pages/topics/list-simple";
import { RunsListSimple } from "@/pages/runs/list-simple";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<TopicsListSimple />} />
          <Route path="/topics" element={<TopicsListSimple />} />
          <Route path="/runs" element={<RunsListSimple />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;