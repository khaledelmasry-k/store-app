import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

const CustomerOrder = lazy(() => import("./pages/CustomerOrder"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const AdminProduct = lazy(() => import("./pages/AdminProduct"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={
        <div style={{
          fontFamily: "'IBM Plex Sans Arabic', sans-serif",
          direction: "rtl",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbf8ff"
        }}>
          <p style={{ color: "#71717a", fontSize: "16px" }}>جاري التحميل...</p>
        </div>
      }>
        <Routes>
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
        <Route path="/store" element={<CustomerOrder />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
        <Route path="/admin/orders" element={<RequireAuth><AdminOrders /></RequireAuth>} />
        <Route path="/admin/product" element={<RequireAuth><AdminProduct /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
