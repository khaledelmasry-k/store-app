import { Router, Switch, Route, Redirect } from 'wouter'
import AdminLogin from "./pages/AdminLogin";
import CustomerOrder from "./pages/CustomerOrder";
import AdminDashboard from "./pages/AdminDashboard";
import AdminOrders from "./pages/AdminOrders";
import AdminProduct from "./pages/AdminProduct";
import AdminSettings from "./pages/AdminSettings";
import AdminSuperAdmin from "./pages/AdminSuperAdmin";
import AdminCustomers from "./pages/AdminCustomers";
import AdminReports from "./pages/AdminReports";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import AdminBilling from "./pages/AdminBilling";
import AdminStoreLinks from "./pages/AdminStoreLinks";
import Landing from "./pages/Landing";

function RequireAuth({ children }: { children: any }) {
  const token = localStorage.getItem("token");
  if (!token) return <Redirect to="/admin/login" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/store" component={CustomerOrder} />
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin" component={() => <RequireAuth><AdminDashboard /></RequireAuth>} />
        <Route path="/admin/orders" component={() => <RequireAuth><AdminOrders /></RequireAuth>} />
        <Route path="/admin/product" component={() => <RequireAuth><AdminProduct /></RequireAuth>} />
        <Route path="/admin/customers" component={() => <RequireAuth><AdminCustomers /></RequireAuth>} />
        <Route path="/admin/reports" component={() => <RequireAuth><AdminReports /></RequireAuth>} />
        <Route path="/admin/settings" component={() => <RequireAuth><AdminSettings /></RequireAuth>} />
        <Route path="/admin/subscriptions" component={() => <RequireAuth><AdminSubscriptions /></RequireAuth>} />
        <Route path="/admin/billing" component={() => <RequireAuth><AdminBilling /></RequireAuth>} />
        <Route path="/admin/store-links" component={() => <RequireAuth><AdminStoreLinks /></RequireAuth>} />
        <Route path="/admin/super-admin" component={() => <RequireAuth><AdminSuperAdmin /></RequireAuth>} />
        <Route component={() => <Redirect to="/admin/login" />} />
      </Switch>
    </Router>
  );
}