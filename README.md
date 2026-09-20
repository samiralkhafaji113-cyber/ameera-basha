# مجمع أميرة باشا – Ameera Basha Complex

موقع عربي (RTL) متجاوب لعرض منتجات المجمع في الحلة – بابل، مع حجز القطع عبر واتساب. Next.js 16 + TypeScript + Tailwind CSS 4.

> **حالة الموقع:** واجهة عرض مبنية على منشورات المجمع العامة في Telegram. لم يُؤكَّد بعد أنه الموقع الرسمي للمجمع، ولا يدّعي الموقع ذلك.

## التشغيل

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck && npm run lint && npm test
npm run build:brand   # يعيد توليد نسخ الشعار والأيقونات وصورة OG من الشعار الرسمي
node scripts/uiux-search.mjs stats   # إحصاءات قاعدة ui-ux-pro-max الفعلية
npm run build && npm start
```

انسخ `.env.example` إلى `.env.local` واضبط `NEXT_PUBLIC_SITE_URL` بدومين النشر الحقيقي (يُستخدم في sitemap وOpen Graph وschema.org). بدونه يُستخدم `http://localhost:3000`.

## مصدر البيانات (لا شيء مُخترَع)

| ما | من أين |
|---|---|
| اسم المنتج / المقاس / العمر / السعر / "متوفر الآن" | نص منشور القناة العامة https://t.me/s/ameera_bashaa (`data/source/telegram-posts.json`) |
| صور المنتجات | صور نفس المنشورات، مضغوطة WebP (800px) في `public/products/<postId>/` |
| رقم الهاتف، العنوان، الروابط، الإحداثيات | من صاحب المشروع + رابط Google Maps المختصر (يُحلّ إلى 32.470232, 44.4144853) |
| صورتا الواجهة والصالة | صور قدّمها صاحب المشروع (`public/store/`) – قُصّت لإخفاء الأشخاص |
| الشعار | الشعار الرسمي الذي قدّمه صاحب المشروع (`brand-source/official-logo-original.jpg`، 640×640 JPG، حبر أسود #050505). المشتقات التقنية فقط (قصّ + luminance→alpha) في `public/brand/` عبر `npm run build:brand` – **لم يُعَد رسمه** |
| Instagram / TikTok | وُجدا بالبحث ثم فُحصا؛ درجة التحقق مسجّلة في `src/data/social.ts` (Instagram = verified، TikTok = probable – يُرجى تأكيده من المالك) |

ما **لم** يُذكر في المصادر يُترك فارغاً في الواجهة: السعر ← «السعر عند الاستفسار»، التوفر ← «التوفر عند الاستفسار». لا توجد ساعات عمل ولا تقييمات ولا عروض ولا عدد فروع.

قواعد مهمة طبّقها السكربت: منشورات أقدم من 12 شهراً تُستبعد (الأسعار تتقادم)، العروض المؤقتة القديمة تُستبعد، والملابس الداخلية تُستبعد من الكتالوج العائلي. **العملة** غير مكتوبة في المنشورات؛ عُرضت الأرقام (مثل `26.500`) على أنها دينار عراقي `26,500 د.ع` حسب العرف المحلي – يُرجى تأكيدها.

### تحديث الكتالوج

1. أعد التقاط المنشورات إلى `data/source/telegram-posts.json` (نفس الصيغة).
2. `npm run build:catalog` → يولّد `src/data/catalog.generated.json` ويحمّل الصور ويضغطها.
3. راجع التصنيف في `scripts/build-catalog.mjs` (`classify`, `NAME_FIX`, `OVERRIDES`, `EXCLUDE_IDS`, `FEATURED_IDS`).

## البنية

```
src/
  app/                 المسارات: / ، /products ، /products/[slug] ، sitemap ، robots ، error/not-found
  components/
    ui/                Button, Badge, Field(Input/Select/Textarea), Modal, Toast, Breadcrumb, States (Loading/Empty/Error)
    layout/            Header, Footer, Logo, MobileActionBar
    products/          ProductCard, ProductBrowser (بحث/فلاتر/ترتيب/عرض), ProductGallery, ReserveButton, ReservationDialog
    sections/          Hero, CategoryCards, FeaturedProducts, WhySection, DeliverySection, LocationSection, ContactSection
    seo/               JSON-LD
  content/ar.ts        كل النصوص العربية (جاهزة لإضافة en.ts لاحقاً)
  data/                categories.ts (التصنيفات) + catalog.generated.json
  lib/                 site.ts (حقائق العمل) · catalog.ts (طبقة الوصول للبيانات) · search.ts · reservation.ts · whatsapp.ts
design/tokens.json     رموز التصميم (3 طبقات) → src/styles/tokens.css
design-system/         MASTER.md (قرارات التصميم + قاعدة ui-ux-pro-max)
docs/brand-guidelines.md  تحليل الشعار الرسمي وقواعد الاستخدام
brand-source/          الشعار الرسمي الأصلي (لا يُعدَّل)
```

### مصادر المنتجات (Telegram / Facebook / Instagram / TikTok)

لكل منتج حقلا `source` و`sourceUrl`. المُدخَل حالياً من **Telegram فقط** (صفحته العامة قابلة للقراءة آلياً). لا يوجد تكامل API مع Facebook أو Instagram أو TikTok، ولا يدّعي الموقع ذلك. لإضافة منتجات من منصة أخرى: أضف سجلات بنفس الشكل (`source: "instagram"` + `sourceUrl` + `postedAt` + الصور) إلى الكتالوج؛ الواجهة تعرض المصدر وأيقونته تلقائياً.

### قنوات التواصل

كلها في `src/data/social.ts` (الرابط + درجة التحقق + الدليل). احذف الإدخال أو اجعل `url: null` فيختفي من الـ Header والـ Footer وقسم التواصل وقسم «تابعنا». روابط `sameAs` في JSON-LD تشمل فقط ما قدّمه المالك أو تحقّق منه أدلة.

### قابلية الانتقال إلى Backend

- **المنتجات:** الواجهة تستدعي `getProductRepository()` فقط (`src/lib/catalog.ts`). للانتقال إلى قاعدة بيانات/CMS/API نفّذ واجهة `ProductRepository` وبدّل الدالة.
- **الحجز:** الواجهة تعتمد على `ReservationRequest` + `ReservationTransport` (`src/lib/reservation.ts`). المرحلة 1 = واتساب. لاحقاً أضف transport يرسل الطلب نفسه إلى API/لوحة تحكم وبدّله في `ReservationDialog` دون إعادة بناء الواجهة.
- **لغة إضافية:** أنشئ `src/content/en.ts` بنفس شكل `ar.ts` واختر القاموس حسب اللغة في `layout.tsx` (`lang`/`dir`).

## الاختبارات

`npm test` (node:test عبر tsx): سلامة بيانات الكتالوج (الصور موجودة، التصنيفات صحيحة، لا أسعار غير صحيحة)، البحث العربي والفلاتر والترتيب، روابط واتساب/الهاتف/فايبر، التحقق من رقم الهاتف العراقي وبناء رسالة الحجز.

## الخلفية ولوحة التحكم (Backend + Admin)

الكتالوج والحجوزات الآن في **Supabase** (Postgres + Auth + Storage) مع لوحة إدارة على `/admin` (منتجات، صور، تصنيفات، حجوزات، وسائط، إعدادات، سجل نشاطات). الواجهة العامة لم تُعَد بناؤها: نفس الهوية والشعار والبحث والفلاتر والبطاقات.

```bash
npm run db:start && npm run db:env   # Supabase محلي (Docker) + .env.local
npm run db:seed                      # ترحيل الـ72 منتجاً (آمن للتكرار) + supabase/migration-report.json
npm run db:create-admin -- --email you@example.com --role admin
npm run dev                          # /admin/login
npm run test:integration             # RLS / منتجات / حجوزات / رفع الصور على Supabase المحلي
```

* **الأسعار المستوردة** بلا عملة مذكورة في المنشورات ← تُخزَّن `currency=NULL, price_verified=false` ويعرض الموقع «السعر عند الاستفسار» حتى يؤكد الأدمن العملة (الإعدادات).
* **الحجز**: يُحفظ في قاعدة البيانات أولاً (رقم `AB-YYYYMMDD-NNNN`) ثم يفتح العميل واتساب بنفسه برسالة جاهزة — لا إرسال تلقائي.
* التفاصيل الكاملة (المخطط، الأدوار، الأمان، النشر السحابي): [docs/backend.md](docs/backend.md).

## النشر (Supabase + Vercel)

- الخطوات الكاملة: [docs/deployment.md](docs/deployment.md) · البنية/النسخ/التراجع: [docs/production.md](docs/production.md) · الأمان: [docs/security.md](docs/security.md).
- فحوص جاهزة: `npm run verify` (lint + typecheck + unit) · `npm run test:integration` (Supabase المحلي) · `npm run smoke:e2e` (اختبار متصفح كامل لأي عنوان: محلي/معاينة/إنتاج) · `npm run prod:*` (سكربتات المشغّل للمشروع البعيد، تقرأ `.env.production.local` وتطلب `--allow-remote`).
- المفاتيح السرية لا تُوضع إلا في `.env.local` أو `.env.production.local` على جهازك، أو (المفاتيح العامة فقط) في Vercel Environment Variables. انظر `.env.example`.
