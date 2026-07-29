import { Router, Switch, Route, Redirect } from 'wouter'
import SellerLogin from "./pages/SellerLogin";
import SellerDashboard from "./pages/SellerDashboard";
import CustomerStore from "./pages/CustomerStore";
import AdminDashboard from "./pages/AdminDashboard";
import AdminOrders from "./pages/AdminOrders";
import AdminProduct from "./pages/AdminProduct";
import AdminCustomers from "./pages/AdminCustomers";
import AdminReports from "./pages/AdminReports";
import AdminStoreLinks from "./pages/AdminStoreLinks";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import AdminSettings from "./pages/AdminSettings";
import AdminBilling from "./pages/AdminBilling";
import AdminSuperAdmin from "./pages/AdminSuperAdmin";
import Landing from "./pages/Landing";
import PublicPricing from "./pages/PublicPricing";
import SuperAdminTenants from "./pages/SuperAdminTenants";
import Onboarding from "./pages/Onboarding";
import MerchantProducts from "./pages/MerchantProducts";
import MerchantSellers from "./pages/MerchantSellers";
import MerchantStoreLinks from "./pages/MerchantStoreLinks";
import MerchantLandingPages from "./pages/MerchantLandingPages";
import MerchantLandingEditor from "./pages/MerchantLandingEditor";
import PublicLanding from "./pages/PublicLanding";
import MerchantSettings from "./pages/MerchantSettings";
import MerchantCustomers from "./pages/MerchantCustomers";
import MerchantAnalytics from "./pages/MerchantAnalytics";
import MerchantReports from "./pages/MerchantReports";
import MerchantTeam from "./pages/MerchantTeam";
import MerchantRoles from "./pages/MerchantRoles";
import AcceptInvitation from "./pages/AcceptInvitation";
import StoreLinkRedirect from "./pages/StoreLinkRedirect";

function RequireAuth({ children }: { children: any }) {
  const token = localStorage.getItem("token");
  if (!token) return <Redirect to="/login" />;
  const adminStr = localStorage.getItem("admin");
  if (adminStr) {
    const admin = JSON.parse(adminStr);
    if (admin.role !== "seller" && admin.role !== "super_admin") return <Redirect to="/login" />;
  }
  return <>{children}</>;
}

function RequireSuperAdmin({ children }: { children: any }) {
  const token = localStorage.getItem("token");
  if (!token) return <Redirect to="/login" />;
  const adminStr = localStorage.getItem("admin");
  if (adminStr) {
    const admin = JSON.parse(adminStr);
    if (admin.role !== "super_admin") return <Redirect to="/admin" />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Switch>
        {/* Public routes */}
        <Route path="/home" component={Landing} />
        <Route path="/" component={Landing} />
        <Route path="/store" component={CustomerStore} />
        <Route path="/go/:slug" component={StoreLinkRedirect} />
        <Route path="/p/:slug" component={PublicLanding} />
        <Route path="/pricing" component={PublicPricing} />
        <Route path="/login" component={SellerLogin} />
        <Route path="/register" component={Onboarding} />

        {/* Super Admin routes */}
        <Route path="/super-admin" component={() => <RequireSuperAdmin><AdminDashboard /></RequireSuperAdmin>} />
        <Route path="/super-admin/orders" component={() => <RequireSuperAdmin><AdminOrders /></RequireSuperAdmin>} />
        <Route path="/super-admin/product" component={() => <RequireSuperAdmin><AdminProduct /></RequireSuperAdmin>} />
        <Route path="/super-admin/customers" component={() => <RequireSuperAdmin><AdminCustomers /></RequireSuperAdmin>} />
        <Route path="/super-admin/reports" component={() => <RequireSuperAdmin><AdminReports /></RequireSuperAdmin>} />
        <Route path="/super-admin/stores" component={() => <RequireSuperAdmin><AdminStoreLinks /></RequireSuperAdmin>} />
        <Route path="/super-admin/subscriptions" component={() => <RequireSuperAdmin><AdminSubscriptions /></RequireSuperAdmin>} />
        <Route path="/super-admin/settings" component={() => <RequireSuperAdmin><AdminSettings /></RequireSuperAdmin>} />
        <Route path="/super-admin/billing" component={() => <RequireSuperAdmin><AdminBilling /></RequireSuperAdmin>} />
        <Route path="/super-admin/store-links" component={() => <RequireSuperAdmin><AdminStoreLinks /></RequireSuperAdmin>} />
        <Route path="/super-admin/tenants" component={() => <RequireSuperAdmin><SuperAdminTenants /></RequireSuperAdmin>} />

        {/* Merchant routes */}
        <Route path="/merchant" component={() => <RequireAuth><AdminDashboard /></RequireAuth>} />
        <Route path="/merchant/orders" component={() => <RequireAuth><AdminOrders /></RequireAuth>} />
        <Route path="/merchant/product" component={() => <RequireAuth><AdminProduct /></RequireAuth>} />
        <Route path="/merchant/customers" component={() => <RequireAuth><MerchantCustomers /></RequireAuth>} />
        <Route path="/merchant/products" component={() => <RequireAuth><MerchantProducts /></RequireAuth>} />
        <Route path="/merchant/products/new" component={() => <RequireAuth><MerchantProducts /></RequireAuth>} />
        <Route path="/merchant/sellers" component={() => <RequireAuth><MerchantSellers /></RequireAuth>} />
        <Route path="/merchant/store-links" component={() => <RequireAuth><MerchantStoreLinks /></RequireAuth>} />
        <Route path="/merchant/settings" component={() => <RequireAuth><MerchantSettings /></RequireAuth>} />
        <Route path="/merchant/landing-pages" component={() => <RequireAuth><MerchantLandingPages /></RequireAuth>} />
        <Route path="/merchant/landing-pages/:id" component={() => <RequireAuth><MerchantLandingEditor /></RequireAuth>} />
        <Route path="/merchant/analytics" component={() => <RequireAuth><MerchantAnalytics /></RequireAuth>} />
        <Route path="/merchant/reports" component={() => <RequireAuth><MerchantReports /></RequireAuth>} />
        <Route path="/merchant/team" component={() => <RequireAuth><MerchantTeam /></RequireAuth>} />
        <Route path="/merchant/roles" component={() => <RequireAuth><MerchantRoles /></RequireAuth>} />

        {/* Public routes */}
        <Route path="/accept-invitation/:token" component={AcceptInvitation} />

        {/* Legacy routes (deprecated — redirect to new paths) */}
        <Route path="/admin" component={() => <RequireAuth><AdminDashboard /></RequireAuth>} />
        <Route path="/admin/orders" component={() => <RequireAuth><AdminOrders /></RequireAuth>} />
        <Route path="/admin/product" component={() => <RequireAuth><AdminProduct /></RequireAuth>} />
        <Route path="/admin/customers" component={() => <RequireAuth><AdminCustomers /></RequireAuth>} />
        <Route path="/admin/reports" component={() => <RequireSuperAdmin><AdminReports /></RequireSuperAdmin>} />
        <Route path="/admin/stores" component={() => <RequireSuperAdmin><AdminStoreLinks /></RequireSuperAdmin>} />
        <Route path="/admin/subscriptions" component={() => <RequireSuperAdmin><AdminSubscriptions /></RequireSuperAdmin>} />
        <Route path="/admin/settings" component={() => <RequireSuperAdmin><AdminSettings /></RequireSuperAdmin>} />
        <Route path="/admin/billing" component={() => <RequireSuperAdmin><AdminBilling /></RequireSuperAdmin>} />
        <Route path="/admin/store-links" component={() => <RequireSuperAdmin><AdminStoreLinks /></RequireSuperAdmin>} />
        <Route path="/admin/super-admin" component={() => <RequireSuperAdmin><AdminSuperAdmin /></RequireSuperAdmin>} />
        <Route path="/seller/dashboard" component={() => <RequireAuth><SellerDashboard /></RequireAuth>} />

        <Route component={() => <Redirect to="/login" />} />
      </Switch>
    </Router>
  );
}
