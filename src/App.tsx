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
import { VerifyEmail } from './shared/components/auth/VerifyEmail'
import { EmailActionHandler } from './shared/components/auth/EmailActionHandler'
import { PlatformLayout } from './shared/components/layout/PlatformLayout'
import { MerchantLayout } from './shared/components/layout/MerchantLayout'
import { StorefrontShell } from './shared/components/layout/StorefrontShell'
import { StoreSlugLoader } from './shared/components/layout/StoreSlugLoader'
import { StoreLinkRedirect } from './shared/components/layout/StoreLinkRedirect'
import { parseStoreLocation } from './shared/utils/store-route'
import { ROUTE_PERMISSIONS } from './shared/utils/constants'
import { InfoPage } from './platform/pages/InfoPage'

// Development-only diagnostics are loaded only in dev builds. Keeping the
// import behind Vite's compile-time DEV flag prevents the route and component
// from entering production chunks at all.
const FirebaseDiagnostics = import.meta.env.DEV
  ? lazy(() => import('./shared/components/dev/FirebaseDiagnostics').then((module) => ({ default: module.FirebaseDiagnostics as any })) as any)
  : null

const PlatformDashboard = lazy(() => import('./platform/pages/Dashboard'))
const PlatformLanding = lazy(() => import('./platform/pages/LandingPage'))
const PlatformMerchants = lazy(() => import('./platform/pages/Merchants'))
const PlatformCrm = lazy(() => import('./platform/pages/Crm'))
const StoreDetails = lazy(() => import('./platform/pages/StoreDetails'))
const PlatformProducts = lazy(() => import('./platform/pages/Products'))
const PlatformOrders = lazy(() => import('./platform/pages/Orders'))
const PlatformOrderDetails = lazy(() => import('./platform/pages/OrderDetails'))
const PlatformCustomers = lazy(() => import('./platform/pages/Customers'))
const PlatformSubscriptions = lazy(() => import('./platform/pages/Subscriptions'))
const PlatformSubscriptionDetail = lazy(() => import('./platform/pages/Subscription'))
const PlatformPlans = lazy(() => import('./platform/pages/Plans'))
const PlatformPromotions = lazy(() => import('./platform/pages/Promotions'))
const PlatformPayments = lazy(() => import('./platform/pages/Payments'))
const PlatformSubscriptionCoupons = lazy(() => import('./platform/pages/SubscriptionCoupons'))
const PlatformReports = lazy(() => import('./platform/pages/Reports'))
const PlatformTickets = lazy(() => import('./platform/pages/Tickets'))
const PlatformAudit = lazy(() => import('./platform/pages/Audit'))
const PlatformNotifications = lazy(() => import('./platform/pages/Notifications'))
const PlatformSettings = lazy(() => import('./platform/pages/Settings'))
const PlatformShippingCompanies = lazy(() => import('./platform/pages/ShippingCompanies'))
const PlatformShippingCompanyDetails = lazy(() => import('./platform/pages/ShippingCompanyDetails'))
const PlatformShippingPartnerApplications = lazy(() => import('./platform/pages/ShippingPartnerApplications'))
const ShippingPartnerApply = lazy(() => import('./platform/pages/ShippingPartnerApply'))

const MerchantDashboard = lazy(() => import('./merchant/pages/Dashboard'))
const MerchantProducts = lazy(() => import('./merchant/pages/Products'))
const MerchantCategories = lazy(() => import('./merchant/pages/Categories'))
const MerchantOrders = lazy(() => import('./merchant/pages/Orders'))
const MerchantOrderDetails = lazy(() => import('./merchant/pages/OrderDetails'))
const MerchantCustomers = lazy(() => import('./merchant/pages/Customers'))
const MerchantCrm = lazy(() => import('./merchant/pages/Crm'))
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
const MerchantThemes = lazy(() => import('./merchant/pages/Themes'))

const StoreHome = lazy(() => import('./store/pages/Home'))
const StoreCatalog = lazy(() => import('./store/pages/Catalog'))
const StoreProduct = lazy(() => import('./store/pages/Product'))
const StoreCart = lazy(() => import('./store/pages/Cart'))
const StoreCheckout = lazy(() => import('./store/pages/Checkout'))
const StoreTrack = lazy(() => import('./store/pages/Track'))
const StoreAccount = lazy(() => import('./store/pages/Account'))
const StoreOrderDetails = lazy(() => import('./store/pages/OrderDetails'))
const StoreLogin = lazy(() => import('./store/pages/Login'))
const StoreLanding = lazy(() => import('./store/pages/Landing'))

function HomeRedirect() {
  const { user, loading, initialized } = useAuth()
  const [, navigate] = useLocation()
  const navigatedRef = useRef(false)
  useEffect(() => {
    if (!initialized || loading || navigatedRef.current) return
    navigatedRef.current = true
    if (!user) return
    if (user.role === 'superAdmin') navigate('/platform/', { replace: true })
    else if ((user.role === 'merchant' || user.role === 'staff') && user.active !== false) {
      const pendingMarker = (() => { try { return sessionStorage.getItem('matjari:email-verification-pending') === '1' } catch { return false } })()
      const target = user.role === 'merchant' && user.emailVerificationRequired && (user.emailVerified !== true || pendingMarker) ? '/verify-email' : '/dashboard/'
      navigate(target, { replace: true })
    }
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

function PlatformSubscriptionRoute({ params }: { params: Record<string, string> }) {
  return <PlatformSubscriptionDetail id={params.id} />
}

function MerchantOrderRoute({ params }: { params: Record<string, string> }) {
  return <MerchantOrderDetails id={params.id} />
}

function StoreProductRoute({ params }: { params: Record<string, string> }) {
  return <StoreProduct id={params.id} />
}

function StoreLinkRedirectRoute({ params }: { params: Record<string, string> }) {
  return <StoreLinkRedirect code={params.code} />
}

function StoreLandingRoute({ params }: { params: Record<string, string> }) {
  return <StoreLanding slug={params.slug} />
}

function PlatformRoutes() {
  return (
    <ZoneRouter prefix="/platform" role="superAdmin" layout={PlatformLayout}>
      <Route path="/" component={() => <PlatformDashboard />} />
      <Route path="/merchants" component={() => <PlatformMerchants />} />
      <Route path="/crm" component={() => <PlatformCrm />} />
      <Route path="/stores" component={() => <Redirect to="/platform/merchants" replace />} />
      <Route path="/stores/:id" component={StoreDetailsRoute} />
      <Route path="/products" component={() => <PlatformProducts />} />
      <Route path="/orders" component={() => <PlatformOrders />} />
      <Route path="/orders/:id" component={PlatformOrderRoute} />
      <Route path="/customers" component={() => <PlatformCustomers />} />
      <Route path="/subscriptions" component={() => <PlatformSubscriptions />} />
      <Route path="/subscriptions/:id" component={PlatformSubscriptionRoute} />
      <Route path="/plans" component={() => <PlatformPlans />} />
      <Route path="/promotions" component={() => <PlatformPromotions />} />
      <Route path="/payments" component={() => <PlatformPayments />} />
      <Route path="/transactions" component={() => <Redirect to="/platform/payments" replace />} />
      <Route path="/coupons" component={() => <PlatformSubscriptionCoupons />} />
      <Route path="/reports" component={() => <PlatformReports />} />
      <Route path="/tickets" component={() => <PlatformTickets />} />
      <Route path="/audit" component={() => <PlatformAudit />} />
      <Route path="/notifications" component={() => <PlatformNotifications />} />
      <Route path="/settings" component={() => <PlatformSettings />} />
      <Route path="/shipping-companies" component={() => <PlatformShippingCompanies />} />
      <Route path="/shipping-companies/applications" component={() => <PlatformShippingPartnerApplications />} />
      <Route path="/shipping-companies/:id" component={({ params }: any) => <PlatformShippingCompanyDetails id={params.id} />} />
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
      <Route path="/crm" component={() => <MerchantCrm />} />
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
      <Route path="/themes" component={() => <MerchantThemes />} />
      <Route path="/settings" component={() => <MerchantSettings />} />
      <Route component={() => <Redirect to="/dashboard" replace />} />
    </ZoneRouter>
  )
}

function StoreOrderRoute({ params }: { params: Record<string, string> }) {
  return <StoreOrderDetails id={params.id} />
}

function StoreRoutes() {
  const [loc] = useLocation()
  const { slug, innerPath } = parseStoreLocation(loc)

  if (!slug) return <Redirect to="/" replace />

  return (
    <StoreSlugLoader>
      <StorefrontShell>
        <Switch location={innerPath}>
          <Route path="/" component={() => <StoreHome />} />
          <Route path="/catalog" component={() => <StoreCatalog />} />
          <Route path="/product/:id" component={StoreProductRoute} />
          <Route path="/cart" component={() => <StoreCart />} />
          <Route path="/checkout" component={() => <StoreCheckout />} />
          <Route path="/track" component={() => <StoreTrack />} />
          <Route path="/account" component={() => <StoreAccount />} />
          <Route path="/account/orders/:id" component={StoreOrderRoute} />
          <Route path="/orders/:id" component={StoreOrderRoute} />
          <Route path="/login" component={() => <StoreLogin />} />
          <Route component={() => <StoreHome />} />
        </Switch>
      </StorefrontShell>
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
                  {import.meta.env.DEV && FirebaseDiagnostics && <Route path="/__dev/firebase" component={FirebaseDiagnostics} />}
                  <Route path="/register" component={Register} />
                  <Route path="/forgot-password" component={ForgotPassword} />
                  <Route path="/verify-email" component={VerifyEmail} />
                  <Route path="/auth/action" component={EmailActionHandler} />
                  <Route path="/partners/shipping/apply" component={() => <ShippingPartnerApply />} />
                  <Route
                    path="/privacy"
                    component={() => (
                      <InfoPage
                        title="سياسة الخصوصية"
                        body={[
                          'آخر تحديث: 28 أغسطس 2026. توضح هذه السياسة كيف تجمع Matjari (متجري) البيانات الشخصية وتستخدمها وتحميها عند استخدام المنصة أو المتاجر المنشأة عبرها.',
                          'البيانات التي قد نجمعها تشمل بيانات الحساب ووسائل التواصل، بيانات المتجر والمنتجات، سجلات الطلبات والدعم، وبيانات تقنية مثل عنوان IP ونوع المتصفح وسجلات الأعطال.',
                          'يجوز للتاجر إدخال بيانات عملائه لتقديم الطلبات وخدمات ما بعد البيع. يظل التاجر مسؤولًا عن وجود أساس قانوني مناسب وإشعار عملائه وفق القوانين السارية.',
                          'نستخدم البيانات لإنشاء الحساب وتشغيل المتجر ومعالجة الطلبات والشحن والدفع، وتقديم الدعم، وتحسين الأداء، ومنع الاحتيال وإساءة الاستخدام والالتزام بالمتطلبات النظامية.',
                          'لا نبيع البيانات الشخصية. وقد نشارك الحد الأدنى اللازم مع مزودي الاستضافة والدفع والتحليلات والشحن الذين يعملون بتعليماتنا، أو عند وجود التزام قانوني أو لحماية الحقوق والسلامة.',
                          'تستخدم ملفات تعريف الارتباط والتقنيات المشابهة لحفظ الجلسة وتفضيلات اللغة والسمة وقياس أداء الصفحات. يمكنك التحكم بها من إعدادات المتصفح، وقد تتأثر بعض الوظائف عند تعطيلها.',
                          'نحتفظ بالبيانات طوال مدة الحساب أو الفترة اللازمة لتقديم الخدمة والوفاء بالالتزامات القانونية وحل النزاعات، ثم نحذفها أو نجهل هويتها وفق إجراءات الاحتفاظ الداخلية.',
                          'نطبق ضوابط وصول وتشفيرًا أثناء النقل وإجراءات مراقبة مناسبة، لكن لا توجد وسيلة نقل أو تخزين إلكترونية مضمونة بصورة مطلقة. يجب الحفاظ على سرية بيانات الدخول ومفاتيح المتجر.',
                          'بحسب القانون المنطبق، قد يحق لك طلب الوصول إلى بياناتك أو تصحيحها أو حذفها أو تقييد معالجتها أو الاعتراض عليها أو طلب نسخة منها. تواصل معنا عبر قنوات الدعم للتحقق من الطلب والرد عليه.',
                          'لا تستهدف المنصة الأطفال، ولا يجوز إنشاء حساب نيابة عن قاصر دون موافقة وليه حيث يلزم. إذا علمت بتزويدنا ببيانات طفل بصورة غير مناسبة فأبلغنا لنراجعها.',
                          'قد نحدّث هذه السياسة عند تغيير الخدمة أو المتطلبات القانونية. سنعرض تاريخ التحديث، ويعد استمرار استخدام الخدمة بعد التحديث قبولًا بالصياغة الجديدة في الحدود التي يسمح بها القانون.',
                          'هذه صياغة عامة لا تشكل استشارة قانونية، ويجب مراجعتها وتكييفها مع الدولة والكيان القانوني ووسائل المعالجة الفعلية قبل النشر التجاري.',
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
                          'آخر تحديث: 28 أغسطس 2026. تحكم هذه الشروط استخدام منصة Matjari (متجري) وخدمات إنشاء المتاجر وإدارتها والمتاجر العامة المرتبطة بها.',
                          'بإنشاء حساب أو استخدام أي جزء من الخدمة تقر بأنك قرأت هذه الشروط وتملك الصلاحية لقبولها. إذا لم توافق عليها، توقف عن الاستخدام ولا تنشئ متجرًا.',
                          'أنت مسؤول عن دقة بيانات الحساب والمتجر، وعن حماية بيانات الدخول، وعن جميع الأنشطة التي تتم من حسابك وإبلاغنا فورًا بأي استخدام غير مصرح به.',
                          'تلتزم باستخدام المنصة بطريقة قانونية وأخلاقية، ولا يجوز انتحال الهوية أو نشر محتوى غير قانوني أو مضلل أو منتهك للحقوق، أو محاولة تعطيل الخدمة أو تجاوز ضوابط الأمان.',
                          'تحتفظ بملكية المحتوى الذي ترفعه، وتمنحنا ترخيصًا محدودًا لمعالجته وعرضه فقط لتشغيل الخدمة وتسليمها. تضمن امتلاك الحقوق والتراخيص اللازمة للصور والعلامات والمنتجات.',
                          'التاجر مسؤول عن المنتجات والأسعار والضرائب وسياسات الاسترجاع والضمان وإشعارات الخصوصية والامتثال لقوانين حماية المستهلك والشحن والدفع في الأسواق التي يبيع فيها.',
                          'تسجل الطلبات وفق البيانات التي يدخلها العميل والتاجر. لا نعد بتوافر بوابة دفع أو شركة شحن بعينها، وتظل مسؤولية تنفيذ الطلب وخدمة العميل على التاجر ما لم ينص اتفاق منفصل على غير ذلك.',
                          'تخضع الباقات المدفوعة للأسعار ودورات الفوترة المعروضة عند الاشتراك. قد تتغير الأسعار مستقبلًا مع إشعار مناسب، ولا تعني التجربة المجانية ضمان استمرار أي ميزة أو سعر.',
                          'يجوز لنا تعليق أو إنهاء الحساب عند مخالفة الشروط أو وجود خطر أمني أو التزام قانوني. سنحاول، حيثما يسمح القانون، منح إشعار وفرصة معقولة للمعالجة، مع حفظ الحقوق والالتزامات المستحقة.',
                          'تقدم الخدمة كما هي وحسب التوافر، دون ضمان خلوها من الانقطاع أو الأخطاء. لا نضمن ملاءمتها لغرض قانوني أو تجاري محدد، وعلى التاجر الاحتفاظ بنسخ مناسبة من بياناته.',
                          'في الحدود التي يسمح بها القانون، لا نكون مسؤولين عن خسائر غير مباشرة أو فقد أرباح أو بيانات ناتجة عن محتوى التاجر أو سلوك العملاء أو خدمات أطراف خارجية. لا يحد ذلك من المسؤولية التي لا يجوز استبعادها قانونًا.',
                          'لا يجوز نقل الحساب أو الحقوق الناشئة عن هذه الشروط إلا وفق القانون وبموافقتنا عند الحاجة. تمثل هذه الشروط الاتفاق الكامل بشأن الخدمة، وأي شروط إضافية مكتوبة ومعلنة تسري على الجزء الخاص بها.',
                          'يجب تحديد القانون المختص والجهة القضائية في النسخة النهائية بما يناسب الكيان القانوني ومكان تقديم الخدمة قبل النشر. تواصل معنا عبر الدعم لأي استفسار أو شكوى.',
                          'هذه صياغة عامة وليست استشارة قانونية، ويجب مراجعتها من محامٍ مرخص وتخصيصها لسياسات Matjari الفعلية قبل اعتمادها نهائيًا.',
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
                          'فريق Matjari جاهز لمساعدتك في أي وقت.',
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

                  <Route path="/s/:code" component={StoreLinkRedirectRoute} />

                  <Route path="/landing/:slug" component={StoreLandingRoute} />

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
