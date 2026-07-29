# برومبت إكمال مشروع M&K Store - opencode

## وصف المشروع
منصة SaaS متعددة المستأجرين (Multi-Tenant) للتجارة الإلكترونية، مبنية بـ:
- **الفرونت إند**: Preact + TypeScript + Vite + wouter (راوتر)
- **الباك إند**: Express.js + Prisma ORM + SQLite/PostgreSQL
- **اللغة**: Arabic RTL
- **التصميم**: Mobile-first

## هيكل المجلدات الرئيسي
```
store/
├── src/                     # Frontend Preact
│   ├── pages/               # جميع الصفحات
│   ├── components/          # المكونات المشتركة
│   ├── services/api.ts      # API client
│   └── types/index.ts       # TypeScript interfaces
├── server/                  # Backend Express
│   ├── src/
│   │   ├── routes/          # API routes
│   │   │   ├── admin.ts     # Authentication
│   │   │   ├── orders.ts    # Orders + Dashboard
│   │   │   ├── product.ts   # Product CRUD
│   │   │   ├── store.ts     # Public store + order submission
│   │   │   ├── settings.ts  # Stores + Admins settings
│   │   │   ├── upload.ts    # Image upload
│   │   │   ├── subscriptions.ts  # Subscription requests
│   │   │   └── seller/      # Seller-specific routes
│   │   ├── middleware/auth.ts
│   │   └── utils/
│   ├── prisma/schema.prisma
│   └── functions/index.js   # Firebase legacy (يمكن إهماله)
├── docs/
│   ├── MASTER_ARCHITECTURE.md  # توثيق كامل لل system architecture
│   ├── PROJECT_ROADMAP.md      # خريطة الطريق
│   └── stitch-prompts/         # 10 prompts تفصيلية لـ Google Stitch
└── vite.config.ts
```

---

## المهام المطلوب إنجازها (بترتيب الأولوية)

### 1. إصلاح الأخطاء (Bugs) - أولوية عالية جداً

#### 1.1 `confirmedOrders` مفقود من الباك إند
- **المشكلة**: `AdminDashboard.tsx` يستخدم `stats?.confirmedOrders?.toLocaleString()` لكن الباك إند يرجع `confirmedRevenue` مش `confirmedOrders`
- **الحل**: أضف `confirmedOrders` في response الـ dashboard endpoint، أو عدل الـ frontend

#### 1.2 useEffect missing dependency
- **المشكلة**: في `AdminOrders.tsx`، `fetchOrders` معرف جوه الـ component ومش مضاف في dependency array بتاع `useEffect`
- **الحل**: لف `fetchOrders` بـ `useCallback` أو انقلها خارج الـ component

#### 1.3 صفحات AdminBilling و AdminSubscriptions ستاتيك
- **المشكلة**: بيحتويوا على بيانات hardcoded، مش بيجيبوا حاجة من API
- **الحل**: وصلهم بـ API calls حقيقية (`/api/subscriptions/plans` موجود فعلاً)

#### 1.4 أسماء المتاجر Hardcoded
- **المشكلة**: `getStoreBadge()` في `AdminOrders.tsx` بتستخدم `ref === "1" ? "بنطلون الساحل" : "مالك ستور"` بدل ما تجيب الاسم من API
- **الحل**: استخدم `api.get("/api/admin/settings/stores")` أو اربطها بالـ storeId

#### 1.5 Sidebar بيستخدم fetch الخام
- **المشكلة**: `Sidebar.tsx` بيستخدم `fetch("/api/admin/settings/stores")` بدل `api.get()` - مش بيعمل error handling موحد
- **الحل**: استخدم `import { api } from "../services/api"` و `api.get<Store[]>("settings/stores")`

#### 1.6 الفوتر فيه "2024" قديم
- معظم الصفحات فيها حقوق نشر 2024 - حدثها لـ 2025 أو استخدم `new Date().getFullYear()`

#### 1.7 AdminReports ملهاش guard
- صفحة التقارير مش بتتأكد من صلاحية `super_admin` - أي تاجر عادي ممكن يشوفها

### 2. إكمال Features ناقصة - أولوية عالية

#### 2.1 إنشاء أمر من لوحة التحكم
- **المشكلة**: مفيش `POST /api/admin/orders` - المـوثق بيقول إنه موجود لكن الكود مش موجود
- **المطلوب**: أضف endpoint لإنشاء أمر جديد من الأدمن (نفس logic الـ store routes لكن بحرية أكتر)

#### 2.2 تصدير CSV
- **المشكلة**: أزرار التصدير في `AdminOrders.tsx` و `AdminReports.tsx` مش بتشتغل
- **المطلوب**: نفذ `GET /api/admin/orders/export` يرجع CSV مع file download

#### 2.3 Pagination + Search في صفحة العملاء
- **المشكلة**: `AdminCustomers.tsx` بيجيب 1000 أمر client-side بدل pagination من الباك إند
- **المطلوب**: أضف `GET /api/admin/customers` مع search + pagination

#### 2.4 حذف وتعديل المنتج
- **المشكلة**: زرار الحذف في صفحة المنتج مش شغال
- **المطلوب**: أضف `DELETE /api/admin/product/:id` و `PATCH /api/admin/product/:id`

#### 2.5 Sales Dashboard (مبيعات)
- **المطلوب**: صفحة مبيعات بتعرض رسوم بيانية بسيطة (Chart.js أو plain HTML/CSS) للمبيعات على مدار 30 يوم

### 3. Multi-Tenant (SaaS) - أولوية متوسطة

#### 3.1 Tenant isolation
- كل route لازم تراعي `tenantId` - حالياً `tenantId` موجود في schema لكن مش مستخدم
- أضف middleware يضيف `tenantId` لكل query

#### 3.2 Role-Based Access Control
- الجدولين `Role` و `Permission` موجودين في schema لكن مش مستخدمين
- نفذ RBAC بسيط

#### 3.3 Invitation system
- نموذج `Invitation` موجود في schema - نفذ API و UI للدعوات

#### 3.4 StoreLink management page
- صفحة لإدارة روابط المتجر (StoreLink) - حالياً `AdminStoreLinks.tsx` بيستخدم `Store` مش `StoreLink`

### 4. تحسينات - أولوية منخفضة

#### 4.1 Firebase Functions
- `functions/index.js` فيه نسخة قديمة من الـ API بدون multi-tenant features
- قرر: إما حذف الملف أو تحديثه

#### 4.2 AdminSubscriptions تجيب الخطط من API
- الباك إند عنده `/api/subscriptions/plans` يرجع الخطط - الـ frontend مش بيستخدمه

#### 4.3 Toast messages
- في `AdminProduct.tsx`، رسائل النجاح/الخطأ فيها مشاكل CSS (class name مختلف)

---

## مهم جداً: Constraints

- **لا تفترض وجود أي ميزات غير مذكورة**
- **لا تعيد تصميم التخطيط الحالي (layout)**
- **لا تنشئ صفحات غير مطلوبة**
- **حافظ على التوافق مع الإصدار القديم (V1 backward compatibility)**
- `tenantId` لازم يفضل Optional عشان V1 القديم شغال
- كل الكود عربي RTL
- Mobile-first

## الأوامر اللي تشتغل
```bash
npm run dev          # تشغيل frontend dev server (Vite)
npm run build        # بناء frontend
npm run lint         # oxlint - فحص الأخطاء
npm run typecheck    # tsc --noEmit - فحص TypeScript
cd server && npx tsx src/index.ts  # تشغيل backend
cd server && npx prisma studio     # فتح Prisma Studio
```

## ملاحظات إضافية
- **Database currently**: SQLite (`server/prisma/dev.db`)
- **Deployment targets**: Render.com + Firebase Hosting
- **JWT secret**: في `.env` تحت اسم `JWT_SECRET`
- **Admin seed**: admin / admin123 (role: super_admin)

## مثال على نمط الكود
```tsx
// Preact component pattern
export function ComponentName() {
  const [data, setData] = useState<Type | null>(null);
  useEffect(() => { api.get<Type>("/path").then(setData); }, []);
  return <div class="container">{/* JSX */}</div>;
}

// API call pattern
import { api } from "../services/api";
const res = await api.get<ResponseType>("/api/admin/endpoint");

// Express route pattern
router.get("/path", authMiddleware, async (req, res) => {
  const data = await prisma.model.findMany({ where: {...} });
  res.json(data);
});
```
