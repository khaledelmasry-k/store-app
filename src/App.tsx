import { Router, Route, Switch, Redirect, useLocation } from 'wouter'
import { useEffect, useRef } from 'preact/hooks'
import { AuthProvider } from './shared/contexts/AuthProvider'
import { ThemeProvider } from './shared/contexts/ThemeProvider'
import { ToastProvider } from './shared/contexts/ToastProvider'
import { StoreProvider } from './shared/contexts/StoreProvider'
import { CartProvider } from './shared/contexts/CartProvider'
import { useAuth } from './shared/hooks/useAuth'
import { lazy } from './shared/utils/lazy'
import { ToastViewport } from './shared/components/ui/ToastViewport'
import { ZoneRouter } from './shared/components/routing/ZoneRouter'
import { Login } from './shared/components/auth/Login'
import { Register } from './shared/components/auth/Register'
import { ForgotPassword } from './shared/components/auth/ForgotPassword'
import { PlatformLayout } from './shared/components/layout/PlatformLayout'
import { MerchantLayout } from './shared/components/layout/MerchantLayout'
import { StoreLayout } from './shared/components/layout/StoreLayout'
import { StoreSlugLoader } from './shared/components/layout/StoreSlugLoader'
import { parseStoreLocation } from './shared/utils/store-route'
import { ROUTE_PERMISSIONS } from './shared/utils/constants'
import { InfoPage } from './platform/pages/InfoPage'

const PlatformDashboard = lazy(() => import('./platform/pages/Dashboard'))
const PlatformLanding = lazy(() => import('./platform/pages/LandingPage'))
const PlatformMerchants = lazy(() => import('./platform/pages/Merchants'))
const StoreDetails = lazy(() => import('./platform/pages/StoreDetails'))
const PlatformProducts = lazy(() => import('./platform/pages/Products'))
const PlatformOrders = lazy(() => import('./platform/pages/Orders'))
const PlatformOrderDetails = lazy(() => import('./platform/pages/OrderDetails'))
const PlatformCustomers = lazy(() => import('./platform/pages/Customers'))
const PlatformSubscriptions = lazy(() => import('./platform/pages/Subscriptions'))
const PlatformPlans = lazy(() => import('./platform/pages/Plans'))
const PlatformPayments = lazy(() => import('./platform/pages/Payments'))
const PlatformCoupons = lazy(() => import('./platform/pages/Coupons'))
const PlatformReports = lazy(() => import('./platform/pages/Reports'))
const PlatformTickets = lazy(() => import('./platform/pages/Tickets'))
const PlatformAudit = lazy(() => import('./platform/pages/Audit'))
const PlatformNotifications = lazy(() => import('./platform/pages/Notifications'))
const PlatformSettings = lazy(() => import('./platform/pages/Settings'))

const MerchantDashboard = lazy(() => import('./merchant/pages/Dashboard'))
const MerchantProducts = lazy(() => import('./merchant/pages/Products'))
const MerchantCategories = lazy(() => import('./merchant/pages/Categories'))
const MerchantOrders = lazy(() => import('./merchant/pages/Orders'))
const MerchantOrderDetails = lazy(() => import('./merchant/pages/OrderDetails'))
const MerchantCustomers = lazy(() => import('./merchant/pages/Customers'))
const MerchantCoupons = lazy(() => import('./merchant/pages/Coupons'))
const MerchantShipping = lazy(() => import('./merchant/pages/Shipping'))
const MerchantAnalytics = lazy(() => import('./merchant/pages/Analytics'))
const MerchantTeam = lazy(() => import('./merchant/pages/Team'))
const MerchantLandingPages = lazy(() => import('./merchant/pages/LandingPages'))
const MerchantStoreLinks = lazy(() => import('./merchant/pages/StoreLinks'))
const MerchantNotifications = lazy(() => import('./merchant/pages/Notifications'))
const MerchantTickets = lazy(() => import('./merchant/pages/Tickets'))
const MerchantSubscription = lazy(() => import('./merchant/pages/Subscription'))
const MerchantSettings = lazy(() => import('./merchant/pages/Settings'))

const StoreHome = lazy(() => import('./store/pages/Home'))
const StoreCatalog = lazy(() => import('./store/pages/Catalog'))
const StoreProduct = lazy(() => import('./store/pages/Product'))
const StoreCart = lazy(() => import('./store/pages/Cart'))
const StoreCheckout = lazy(() => import('./store/pages/Checkout'))
const StoreTrack = lazy(() => import('./store/pages/Track'))
const StoreAccount = lazy(() => import('./store/pages/Account'))
const StoreLogin = lazy(() => import('./store/pages/Login'))

function HomeRedirect() {
  const { user, loading, initialized } = useAuth()
  const [, navigate] = useLocation()
  const navigatedRef = useRef(false)
  useEffect(() => {
    if (!initialized || loading || navigatedRef.current) return
    navigatedRef.current = true
    if (!user) return
    if (user.role === 'superAdmin') navigate('/platform/', { replace: true })
    else if ((user.role === 'merchant' || user.role === 'staff') && user.active !== false) navigate('/dashboard/', { replace: true })
    // Customers have no platform dashboard — keep them on the public landing.
    else if (user.role === 'customer') return
  }, [user, initialized, loading, navigate])
  return <PlatformLanding />
}

function LoginByRole() {
  const [loc] = useLocation()
  const params = new URLSearchParams(loc.split('?')[1] || window.location.search)
  const role = params.get('role') || 'platform'
  if (role === 'merchant') return <Login role="merchant" />
  if (role === 'customer') return <Login role="customer" />
  return <Login role="platform" />
}

function StoreDetailsRoute({ params }: { params: Record<string, string> }) {
  return <StoreDetails id={params.id} />
}

function PlatformOrderRoute({ params }: { params: Record<string, string> }) {
  return <PlatformOrderDetails id={params.id} />
}

function MerchantOrderRoute({ params }: { params: Record<string, string> }) {
  return <MerchantOrderDetails id={params.id} />
}

function StoreProductRoute({ params }: { params: Record<string, string> }) {
  return <StoreProduct id={params.id} />
}

function PlatformRoutes() {
  return (
    <ZoneRouter prefix="/platform" role="superAdmin" layout={PlatformLayout}>
      <Route path="/" component={() => <PlatformDashboard />} />
      <Route path="/merchants" component={() => <PlatformMerchants />} />
      <Route path="/stores" component={() => <Redirect to="/platform/merchants" replace />} />
      <Route path="/stores/:id" component={StoreDetailsRoute} />
      <Route path="/products" component={() => <PlatformProducts />} />
      <Route path="/orders" component={() => <PlatformOrders />} />
      <Route path="/orders/:id" component={PlatformOrderRoute} />
      <Route path="/customers" component={() => <PlatformCustomers />} />
      <Route path="/subscriptions" component={() => <PlatformSubscriptions />} />
      <Route path="/plans" component={() => <PlatformPlans />} />
      <Route path="/payments" component={() => <PlatformPayments />} />
      <Route path="/transactions" component={() => <Redirect to="/platform/payments" replace />} />
      <Route path="/coupons" component={() => <PlatformCoupons />} />
      <Route path="/reports" component={() => <PlatformReports />} />
      <Route path="/tickets" component={() => <PlatformTickets />} />
      <Route path="/audit" component={() => <PlatformAudit />} />
      <Route path="/notifications" component={() => <PlatformNotifications />} />
      <Route path="/settings" component={() => <PlatformSettings />} />
      <Route component={() => <Redirect to="/platform" replace />} />
    </ZoneRouter>
  )
}

function MerchantRoutes() {
  const [loc] = useLocation()
  const routeKey = loc.split('?')[0]
  const permission = ROUTE_PERMISSIONS[routeKey] || ROUTE_PERMISSIONS[Object.keys(ROUTE_PERMISSIONS).find((p) => routeKey.startsWith(p + '/')) || '']

  return (
    <ZoneRouter prefix="/dashboard" role="merchant" permission={permission} layout={MerchantLayout}>
      <Route path="/" component={() => <MerchantDashboard />} />
      <Route path="/products" component={() => <MerchantProducts />} />
      <Route path="/inventory" component={() => <Redirect to="/dashboard/products" replace />} />
      <Route path="/categories" component={() => <MerchantCategories />} />
      <Route path="/orders" component={() => <MerchantOrders />} />
      <Route path="/orders/:id" component={MerchantOrderRoute} />
      <Route path="/customers" component={() => <MerchantCustomers />} />
      <Route path="/coupons" component={() => <MerchantCoupons />} />
      <Route path="/shipping" component={() => <MerchantShipping />} />
      <Route path="/reports" component={() => <Redirect to="/dashboard/analytics" replace />} />
      <Route path="/analytics" component={() => <MerchantAnalytics />} />
      <Route path="/team" component={() => <MerchantTeam />} />
      <Route path="/roles" component={() => <Redirect to="/dashboard/team" replace />} />
      <Route path="/landing-pages" component={() => <MerchantLandingPages />} />
      <Route path="/store-links" component={() => <MerchantStoreLinks />} />
      <Route path="/notifications" component={() => <MerchantNotifications />} />
      <Route path="/tickets" component={() => <MerchantTickets />} />
      <Route path="/subscription" component={() => <MerchantSubscription />} />
      <Route path="/settings" component={() => <MerchantSettings />} />
      <Route component={() => <Redirect to="/dashboard" replace />} />
    </ZoneRouter>
  )
}

function StoreRoutes() {
  const [loc] = useLocation()
  const { slug, innerPath } = parseStoreLocation(loc)

  if (!slug) return <Redirect to="/" replace />

  return (
    <StoreSlugLoader>
      <StoreLayout>
        <Switch location={innerPath}>
          <Route path="/" component={() => <StoreHome />} />
          <Route path="/catalog" component={() => <StoreCatalog />} />
          <Route path="/product/:id" component={StoreProductRoute} />
          <Route path="/cart" component={() => <StoreCart />} />
          <Route path="/checkout" component={() => <StoreCheckout />} />
          <Route path="/track" component={() => <StoreTrack />} />
          <Route path="/account" component={() => <StoreAccount />} />
          <Route path="/login" component={() => <StoreLogin />} />
          <Route component={() => <StoreHome />} />
        </Switch>
      </StoreLayout>
    </StoreSlugLoader>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <StoreProvider>
            <Router>
              <CartProvider>
                <Switch>
                  <Route path="/" component={HomeRedirect} />
                  <Route path="/login" component={LoginByRole} />
                  <Route path="/register" component={Register} />
                  <Route path="/forgot-password" component={ForgotPassword} />
                  <Route
                    path="/privacy"
                    component={() => (
                      <InfoPage
                        title="سياسة الخصوصية"
                        body={[
                          'خصوصية بياناتك وبيانات عملائك مسؤولية نأخذها على محمل الجد في M&K Store.',
                          'بيانات متاجرك وعملائك ملك لك وحدك. نحن لا نبيع بياناتك ولا نشاركها مع أي جهة خارجية.',
                          'نستخدم بياناتك فقط لتشغيل خدمات المنصة وتحسين تجربتك، ونطبق أفضل ممارسات الأمان في حفظها ومعالجتها.',
                        ]}
                      />
                    )}
                  />
                  <Route
                    path="/terms"
                    component={() => (
                      <InfoPage
                        title="شروط الاستخدام"
                        body={[
                          'باستخدامك منصة M&K Store فأنت توافق على شروط الاستخدام هذه.',
                          'أنت مسؤول عن صحة البيانات التي تدخلها، وعن الالتزام بالقوانين في بلدك عند استخدام المتجر.',
                          'تحتفظ المنصة بحق إيقاف أي حساب يخالف شروط الاستخدام أو يسيء استخدام الخدمة.',
                        ]}
                      />
                    )}
                  />
                  <Route
                    path="/contact"
                    component={() => (
                      <InfoPage
                        title="تواصل معنا"
                        body={[
                          'فريق M&K Store جاهز لمساعدتك في أي وقت.',
                          'يمكنك التواصل معنا عبر قسم الدعم من داخل لوحة التحكم، وسنرد عليك في أقرب وقت.',
                        ]}
                      />
                    )}
                  />

                  <Route path="/platform" component={PlatformRoutes} />
                  <Route path="/platform/*" component={PlatformRoutes} />

                  <Route path="/dashboard" component={MerchantRoutes} />
                  <Route path="/dashboard/*" component={MerchantRoutes} />

                  <Route path="/store/:slug" component={StoreRoutes} />
                  <Route path="/store/:slug/*" component={StoreRoutes} />

                  <Route component={() => <Redirect to="/" replace />} />
                </Switch>
              </CartProvider>
            </Router>
            <ToastViewport />
          </StoreProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
