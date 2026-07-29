# برومبت Stitch — تطوير كامل (UI + API + Data)

## فلسفة Full‑Stack
هذا البرومبت يصف **النظام بالكامل**. كل ميزة في التصميم لها نقطة نهاية API محددة، ونموذج بيانات محدد، وسلوك متكامل من الواجهة إلى الخادم. لا توجد ميزة بلا API. لا توجد واجهة بلا حالة تحميل/خطأ/نجاح.

---

## 1. نموذج البيانات (Data Models)

### 1.1 Product
```
{
  id: string
  name: string
  description: string
  price: number            // السعر الافتراضي
  oldPrice: number | null  // السعر القديم (للعرض كتخفيض)
  active: boolean
  colors: string[]          // ["أسود", "أبيض"]
  sizes: string[]           // ["L", "XL", "XXL"]
  images: Record<string, string>  // { "أسود": "url.jpg", "أبيض": "url.jpg" }
  variantStock: Record<string, Record<string, number>>  // { "أسود": { "L": 10, "XL": 5 } }
  pricingTiers: Record<string, number>  // { "1": 500, "2": 900, "3": 1200, "4": 1400 }
  createdAt: string
  updatedAt: string
}
```

### 1.2 Order
```
{
  id: string
  customerName: string
  phone: string
  governorate: string
  city: string
  address: string
  notes: string
  status: OrderStatus
  items: OrderItem[]
  totalPrice: number
  createdBy: string    // "1" = بنطلون الساحل, "2" = مالك ستور
  createdAt: string
  updatedAt: string
}
```

### 1.3 OrderItem
```
{
  id: string
  orderId: string
  color: string
  size: string
  quantity: number
  unitPrice: number
}
```

### 1.4 OrderStatus
```
"NEW" | "CONTACTED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED"
```

### 1.5 Admin
```
{
  id: string
  username: string
  token: string     // JWT
}
```

### 1.6 DashboardStats
```
{
  totalOrders: number
  expectedRevenue: number       // مجموع non-CANCELLED + non-RETURNED
  confirmedRevenue: number      // مجموع DELIVERED فقط
  newOrders: number
  contactedOrders: number
  processingOrders: number
  shippedOrders: number
  deliveredOrders: number
  cancelledOrders: number
  returnedOrders: number
  totalStock: number
  variantStock: Record<string, Record<string, number>>
  khaledStats: PersonStats
  mahmoudStats: PersonStats
}
```

### 1.7 PersonStats
```
{
  totalOrders: number
  newOrders: number
  contactedOrders: number
  processingOrders: number
  shippedOrders: number
  deliveredOrders: number
  cancelledOrders: number
  returnedOrders: number
  expectedRevenue: number
  confirmedRevenue: number
  totalQuantity: number
}
```

### 1.8 PaginatedResponse<T>
```
{
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
```

---

## 2. نقاط النهاية (API Endpoints)

### 2.1 تسجيل الدخول
`POST /api/admin/login`
```
Request:  { username: string, password: string }
Response: { token: string, admin: { id: string, username: string } }
خطأ 401:  { error: "اسم المستخدم أو كلمة المرور غير صحيحة" }
```

### 2.2 لوحة التحكم
`GET /api/admin/orders/dashboard` — يتطلب `Authorization: Bearer <token>`
```
Response: DashboardStats
خطأ 401:  { error: "غير مصرح" }
```

### 2.3 قائمة الطلبات
`GET /api/admin/orders?page=1&limit=10&search=&phone=&status=` — يتطلب token
```
Response: PaginatedResponse<Order>
```

### 2.4 تحديث حالة الطلب
`PATCH /api/admin/orders/:id/status` — يتطلب token
```
Request:  { status: OrderStatus }
Response: Order
```
**سلوك جانبي**: إذا تغيرت الحالة إلى `RETURNED`، استرجع الكمية إلى `variantStock` (زيادة الكمية).
إذا تغيرت من `RETURNED` إلى حالة أخرى، اطرح الكمية من `variantStock` (نقص الكمية).

### 2.5 حذف الطلب
`DELETE /api/admin/orders/:id` — يتطلب token
```
Response: { success: true }
```
**سلوك جانبي**: استرجع الكمية إلى `variantStock` قبل الحذف.

### 2.6 الحصول على المنتج
`GET /api/admin/product` — يتطلب token
```
Response: Product
```

### 2.7 تحديث المنتج
`PUT /api/admin/product` — يتطلب token
```
Request:  Partial<Product>
Response: Product
```

### 2.8 رفع صورة
`POST /api/admin/upload` — يتطلب token, multipart/form-data
```
Request:  FormData مع { image: File, color: string }
Response: { url: string }
```

### 2.9 تقديم طلب (عام — لا يحتاج token)
`POST /api/orders`
```
Request: {
  customerName: string
  phone: string
  governorate: string
  city: string
  address: string
  notes: string
  items: { color: string, size: string, quantity: number }[]
  ref: string     // "1" أو "2"
}
Response: { success: true, orderId: string }
خطأ 400:  { error: "الكمية غير متوفرة للمنتج المطلوب" }
```
**سلوك جانبي**: تحقق من توفر الكمية في `variantStock` → قلل الكمية → أنشئ الطلب.

### 2.10 التحقق من الصحة (Health)
`GET /api/health`
```
Response: { status: "ok" }
```

---

## 3. الصفحات — مع API و Data Flow كامل

### 3.1 صفحة العميل (`/store?ref=1` أو `/store?ref=2`)

**On Mount:**
```
GET /api/health  →  إذا فشل: "الخدمة غير متاحة. حاول مرة أخرى."
GET /api/admin/product  →  تجهيز بيانات المنتج (الألوان، المقاسات، المخزون، الصور، شرائح السعر)
```

**On Submit ("تأكيد الطلب"):**
```
Validation:
  - customerName: required, min 2 chars
  - phone: required, pattern /^01[0-9]{9}$/
  - governorate: required, must be selected
  - city: required, must be selected
  - address: required, min 5 chars
  - items: at least 1 item with color AND size selected
  - total quantity: > 0

Call: POST /api/orders { ...items, ref }

Success (200):
  - إخفاء النموذج بالكامل
  - عرض رسالة النجاح (مع orderId)
  - زر "طلب جديد" يعيد تعيين النموذج

Error (400):
  - عرض رسالة الخطأ أعلى الزر (مثال: "هذا المقاس غير متوفر حالياً")

Network Error:
  - عرض "حدث خطأ في الاتصال. تحقق من اتصالك بالإنترنت وحاول مرة أخرى."
  - تفعيل الزر مرة أخرى
```

**حساب السعر (UI Only):**
```
function getPrice(totalQty: number, tiers: Record<string, number>): number {
  const sorted = Object.entries(tiers).sort((a, b) => Number(a[0]) - Number(b[0]));
  let price = 0;
  for (const [qty, p] of sorted) {
    if (totalQty >= Number(qty)) price = p;
  }
  return totalQty * price;
}
```
يتم إعادة الحساب عند كل تغيير في الكمية أو إضافة/حذف صف.

**Stock Check (UI Only):**
```
function isAvailable(color: string, size: string, stock: Record<string, Record<string, number>>): boolean {
  return (stock[color]?.[size] ?? 0) > 0;
}
```
الخيارات غير المتوفرة: معطلة + "(نفد)".
إذا اختار العميل لون/مقاس ثم نفد (مستخدم آخر اشترى)، عند الإرسال يرجع الخطأ 400.

### 3.2 صفحة تسجيل الدخول (`/admin/login`)

**On Mount:**
إذا كان هناك token في localStorage → `GET /api/admin/orders/dashboard` → نجاح: توجيه إلى `/admin` | فشل: مسح token والبقاء في login

**On Submit:**
```
Call: POST /api/admin/login { username, password }

Success (200):
  - localStorage.setItem("token", response.token)
  - توجيه إلى /admin

Error (401):
  - عرض "اسم المستخدم أو كلمة المرور غير صحيحة" باللون الأحمر
  - تفريغ حقل كلمة المرور

Network Error:
  - عرض "تعذر الاتصال بالخادم"
```

### 3.3 لوحة التحكم (`/admin`) — يتطلب token

**On Mount:**
```
Call: GET /api/admin/orders/dashboard

Loading:
  - عرض 10 بطاقات skeleton (رمادية متحركة) بدلاً من الأرقام
  - عرض "جاري تحميل البيانات..."

Success:
  - عرض البطاقات بالأرقام الحقيقية
  - عرض PersonSection للمتجرين
  - عرض جدول المخزون

Error (401):
  - مسح token → توجيه إلى /admin/login

Error (network):
  - عرض رسالة خطأ مع زر "إعادة المحاولة"
```

**Rebuild (Skeleton Cards):**
عرض 10 بطاقات رمادية بشكل شبكي (نفس grid) مع أنيميشن shimmer. عند تحميل البيانات، تحل محلها البطاقات الحقيقية.

### 3.4 إدارة الطلبات (`/admin/orders`) — يتطلب token

**On Mount:**
```
Call: GET /api/admin/orders?page=1&limit=10

Loading:
  - جدول skeleton به 10 صفوف (أعمدة رمادية متحركة)

Success:
  - عرض الجدول بالبيانات

Empty (data.length === 0 && page === 1):
  - عرض "لا توجد طلبات بعد. شارك رابط المتجر لبدء استقبال الطلبات."

Error: عرض رسالة خطأ + إعادة المحاولة
```

**On Search:**
```
Call: GET /api/admin/orders?page=1&limit=10&search=<name>&phone=<phone>&status=<status>

Loading: تعطيل أزرار البحث + spinner صغير بجانب أزرار البحث
Empty: "لا توجد طلبات مطابقة للبحث"
Error: رسالة خطأ
```

**On Change Status (من داخل الجدول أو المودال):**
```
Call: PATCH /api/admin/orders/:id/status { status: newStatus }

Loading: تعطيل القائمة المنسدلة + "جاري التحديث..."
Success: تحديث الصف في الجدول بدون إعادة تحميل + flash أخضر لمدة ثانيتين
Error: عرض رسالة خطأ + إعادة الحالة إلى سابقتها
```

**On Delete Order:**
```
خطوة 1: عرض مودال تأكيد: "هل أنت متأكد من حذف طلب {name}؟"
خطوة 2 (عند التأكيد):
  Call: DELETE /api/admin/orders/:id
  Loading: تعطيل زر "تأكيد الحذف" + "جاري الحذف..."
  Success: إغلاق المودال + إزالة الصف من الجدول + تحديث العدد الإجمالي
  Error: رسالة خطأ + تفعيل الزر
```

**Pagination:**
```
السابق ← GET /api/admin/orders?page={page-1}&limit=10
التالي ← GET /api/admin/orders?page={page+1}&limit=10

- تعطيل "السابق" إذا page === 1
- تعطيل "التالي" إذا page === totalPages
- عرض "صفحة {page} من {totalPages}"
```

### 3.5 إدارة المنتج (`/admin/product`) — يتطلب token

**On Mount:**
```
Call: GET /api/admin/product

Loading:
  - نموذج كامل ولكن بحقول رمادية (skeleton form) مع spinner

Success (data موجود):
  - تعبئة كل الحقول بالبيانات الحالية
  - عرض الصور الموجودة مع أزرار حذف

Success (data == null — أول مرة):
  - نموذج فارغ مع قيم افتراضية
  - رسالة: "لم يتم إعداد المنتج بعد. قم بإضافة التفاصيل."

Error: عرض رسالة خطأ + إعادة المحاولة
```

**On Save:**
```
Validation (UI):
  - name: required
  - price: required, > 0
  - at least 1 color and 1 size
  - pricingTiers: at least 1 tier

Call: PUT /api/admin/product { formData }

Loading:
  - زر "💾 حفظ التغييرات" ← "جاري الحفظ..." + تعطيل
  - تعطيل كل الحقول أثناء الحفظ

Success:
  - تمكين الزر ← "💾 حفظ التغييرات"
  - رسالة خضراء: "✅ تم حفظ التغييرات بنجاح"
  - تختفي الرسالة بعد 3 ثوانٍ

Error:
  - تمكين الزر + الحقول
  - رسالة حمراء: "❌ فشل الحفظ: {error}"
```

**On Image Upload:**
```
Call: POST /api/admin/upload (multipart: image + color)

Loading:
  - تعطيل زر الرفع + عرض spinner صغير بجانب الصورة
  - أو عرض شريط تقدم (progress bar) إذا أمكن

Success:
  - عرض الصورة المرفوعة فوراً
  - تحديث حقل images بالـ URL الجديد

Error:
  - رسالة: "فشل رفع الصورة. تأكد من أن الملف صورة (jpg, png) وأقل من 5MB"
```

**On Add Color:**
```
- إضافة اللون إلى قائمة colors
- إضافة صف للمصفوفة (variantStock) بقيم افتراضية 0 لكل المقاسات الحالية
- إضافة حقل رفع صورة للون الجديد
```

**On Add Size:**
```
- إضافة المقاس إلى قائمة sizes
- إضافة عمود للمصفوفة (variantStock) بقيمة افتراضية 0 لكل الألوان الحالية
```

**On Delete Color:**
```
- مودال تأكيد: "حذف اللون {name} سيحذف كل المخزون المرتبط به. هل أنت متأكد؟"
- عند التأكيد: إزالة اللون من colors, images, variantStock
```

**On Delete Size:**
```
- مودال تأكيد: "حذف المقاس {name} سيحذف كل المخزون المرتبط به. هل أنت متأكد؟"
- عند التأكيد: إزالة المقاس من sizes وكل المدخلات المرتبطة به في variantStock
```

---

## 4. المكونات المشتركة — مع حالات كاملة

### 4.1 RequireAuth (HOC / Wrapper)
```
if (!localStorage.getItem("token")) → Redirect to /admin/login
else → Render children
```

عند كل تنقل، تحقق من وجود token. إذا كان مسار `/admin` أو `/admin/*` وليس هناك token، وجه إلى `/admin/login`.

### 4.2 Loading Spinner
- أيقونة: دائرة دوارة (border-spinner) 32px، لون `#1a1b22`، سرعة 0.8s
- نص اختياري تحتها بحجم 14px لون `#71717a`
- يستخدم في: تحميل البيانات الأولي، تحميل الصفحات

### 4.3 Skeleton Loader
- مستطيلات رمادية (`#e4e4e7`) مع أنيميشن shimmer (تدرج لوني متحرك)
- يستخدم في: جداول الطلبات أثناء التحميل، بطاقات dashboard
- شكل الجدول: header + 10 صفوف بارتفاعات متساوية
- شكل البطاقات: 10 مربعات في شبكة

### 4.4 Error State
- أيقونة ❌ حمراء 40px
- عنوان: "حدث خطأ"
- نص الوصف: نص الخطأ من API أو "تعذر الاتصال بالخادم"
- زر "إعادة المحاولة": يعيد نفس الطلب الفاشل

### 4.5 Empty State
- أيقونة مناسبة (📋 للطلبات، 📦 للمنتج)
- عنوان وصفي: "لا توجد طلبات بعد"
- نص إضافي: "شارك رابط المتجر لبدء استقبال الطلبات"
- لا يوجد زر (لأن empty state معناه لا يوجد شيء لفعله)

### 4.6 Modal
- Backdrop: `rgba(0,0,0,0.4)` مع fade transition (200ms)
- Container: أبيض، max-width 500px، max-height 80vh، border-radius 8px
- محتوى قابل للتمرير (`overflow-y: auto`)
- زر إغلاق (✕) في أعلى اليسار
- إغلاق بـ: زر ✕، النقر على backdrop، مفتاح Escape
- Focus trap: عند الفتح focus على أول عنصر تفاعل، Tab يتحرك داخل المودال فقط
- `aria-modal="true"` و `role="dialog"`
- `aria-labelledby` يشير إلى عنوان المودال

### 4.7 Confirm Dialog
مودال خاص بالتأكيد:
- أيقونة ⚠️ أو 🗑️
- سؤال التأكيد
- زران: "تأكيد" (أسود أو أحمر) و "إلغاء" (رمادي)

---

## 5. قواعد حماية البيانات والأمان (UI Layer)

### 5.1 حماية المسارات
```
المسارات المحمية: /admin, /admin/orders, /admin/product
المسارات العامة: /store, /admin/login, /

إذا زار مستخدم غير مسجل مساراً محمياً ← توجيه إلى /admin/login
بعد تسجيل الدخول ← توجيه إلى /admin (الصفحة التي كان يحاول الوصول إليها)
```

### 5.2 معالجة 401 (Unauthorized)
```
إذا أي API call يرجع 401:
  1. مسح localStorage.removeItem("token")
  2. توجيه إلى /admin/login
  3. (اختياري) عرض رسالة "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى."
```

### 5.3 عدم تخزين بيانات حساسة في الـ UI
- لا تخزن كلمة المرور أبداً في localStorage
- لا تعرض token في واجهة المستخدم
- لا تظهر كلمة المرور في الحقول (type="password")
- لا تسجل أي بيانات في console.log في الإنتاج

### 5.4 منع الوصول إلى API من المتصفح مباشرة
جميع طلبات API تتم عبر `fetch` مع `Authorization` header. لا توجد مفاتيح API مكشوفة في الـ frontend.

---

## 6. قواعد صارمة — End-to-End Integration

1. ✅ **كل ميزة في الواجهة لها API مقابلة.** لا توجد واجهة تستخدم بيانات وهمية بدون API.
2. ✅ **كل API له 3 حالات**: تحميل (loading)، نجاح (success)، خطأ (error).
3. ✅ **كل نموذج (form) له**: validation، prevent double-submit، رسالة نجاح، رسالة خطأ.
4. ✅ **كل قائمة/جدول له**: تحميل، بيانات، فارغ، خطأ.
5. ✅ **تغيير البيانات (CUD)**: يتم التحديث في الـ UI مباشرة بعد نجاح API بدون إعادة تحميل الصفحة.
6. ✅ **الأخطاء الشبكية** تعامل مع رسالة مناسبة وزر "إعادة المحاولة".
7. ✅ **البيانات الحساسة**: token في localStorage فقط، لا كلمات مرور، لا مفاتيح API.
8. ✅ **الحماية**: كل مسار إداري محمي بـ RequireAuth.
9. ✅ **Stock مطابق**: المخزون المعروض في الـ UI (قبل الإرسال) قد لا يكون دقيقاً 100%. عند الإرسال، API هو من يتحقق من التوفر الفعلي ويرجع 400 إذا نفد.
10. ✅ **API calls تستخدم `fetch` مع `Authorization: Bearer <token>` و `Content-Type: application/json`**.

---

## 7. ملاحظات إضافية

- جميع النصوص بالعربية
- العملة: ج.م (جنيه مصري)
- الأرقام تُنسق بفواصل الآلاف
- مستخدم واحد فقط للإدارة (admin/admin123)
- المنتج واحد فقط
- الطلب الواحد可以有 عناصر متعددة
- السعر حسب شرائح السعر (إجمالي الكمية)
- لا توجد API حقيقية — استخدم Mock Data + Mock Functions
- يجب أن تعمل الـ UI بالكامل مع Mock API (محاكاة استجابات حقيقية مع تأخير 300-800ms لمحاكاة الشبكة)
- Mock API يجب أن يحاكي جميع حالات: النجاح، الفشل (401, 400, 500، انقطاع الشبكة)
- افتح الموقع في المتصفح مباشرة، لا تنتظر build أو deploy
- استخدم localStorage لتخزين حالة تسجيل الدخول والبيانات الوهمية (Mock Database)

---

## 8. Mock API Implementation Notes

Mock API يجب أن يحقق الآتي:
- تخزين البيانات في متغيرات JavaScript (أو localStorage للتجربة الكاملة)
- محاكاة تأخير الشبكة (300-800ms عشوائي)
- التحقق من token في endpoints المحمية
- إرجاع أخطاء واقعية (401 بدون token، 400 لبيانات غير صحيحة)
- تحديث البيانات محلياً (عند تغيير حالة الطلب، حفظ المنتج، إلخ)
- حساب الـ DashboardStats بشكل حقيقي من بيانات الطلبات

**Mock Login:**
```
قبول: { username: "admin", password: "admin123" }
إرجاع: { token: "mock-jwt-token-" + Date.now(), admin: { id: "1", username: "admin" } }
رفض أي شيء آخر بـ 401.
```

**Mock Products (بيانات أولية):**
```
{
  id: "prod-1",
  name: "بنطلون كتان فرنساوي",
  description: "بنطلون كتان عالي الجودة - مناسب لجميع الفصول",
  price: 500,
  oldPrice: null,
  active: true,
  colors: ["أسود", "أبيض", "كحلي"],
  sizes: ["L", "XL", "XXL"],
  images: {},
  variantStock: { "أسود": { "L": 10, "XL": 5, "XXL": 3 }, "أبيض": { "L": 8, "XL": 6, "XXL": 2 }, "كحلي": { "L": 12, "XL": 7, "XXL": 4 } },
  pricingTiers: { "1": 500, "2": 900, "3": 1200, "4": 1400 }
}
```

**Mock Orders (5-10 طلبات وهمية بحالات مختلفة لتجربة كاملة):**
```
[
  { id: "ord-1", customerName: "أحمد محمد", phone: "01012345678", governorate: "القاهرة", city: "مدينة نصر", address: "شارع النيل", notes: "", status: "NEW", items: [{ color: "أسود", size: "L", quantity: 2, unitPrice: 450 }], totalPrice: 900, createdBy: "1", createdAt: "2026-07-27T10:00:00Z" },
  // ... 5-9 طلبات إضافية بحالات مختلفة ومتجرين مختلفين
]
```
