import { Suspense, lazy } from 'preact/compat'
import { Router, Switch, Route, Redirect } from 'wouter'
import AdminLogin from "./pages/AdminLogin";

const CustomerOrder = lazy(() => import("./pages/CustomerOrder"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const AdminProduct = lazy(() => import("./pages/AdminProduct"));

function RequireAuth({ children }: { children: any }) {
  const token = localStorage.getItem("token");
  if (!token) return <Redirect to="/admin/login" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={
        <div style={{
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
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
        <Switch>
          <Route path="/" component={() => <Redirect to="/admin/login" />} />
          <Route path="/store" component={CustomerOrder} />
          <Route path="/admin/login" component={AdminLogin} />
          <Route path="/admin" component={() => <RequireAuth><AdminDashboard /></RequireAuth>} />
          <Route path="/admin/orders" component={() => <RequireAuth><AdminOrders /></RequireAuth>} />
          <Route path="/admin/product" component={() => <RequireAuth><AdminProduct /></RequireAuth>} />
          <Route component={() => <Redirect to="/admin/login" />} />
        </Switch>
      </Suspense>
    </Router>
  );
}
