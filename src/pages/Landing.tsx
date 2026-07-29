import { useState } from "preact/compat";
import { useLocation } from "wouter";

export default function Landing() {
  const [, navigate] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenu(false);
  };

  return (
    <div dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif", color: "#0F1111" }}>
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(19,25,33,0.98)", borderBottom: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 800, color: "#FEBD69", letterSpacing: "-0.02em" }}>M&K Store</span>
            <nav class="landing-nav" style={{ display: "flex", gap: "24px" }}>
              {["المميزات", "الأسعار", "من نحن", "اتصل بنا"].map((item, i) => (
                <a key={item} onClick={() => scrollTo(["features", "pricing", "about", "contact"][i])} style={{ color: "#B0B8C1", cursor: "pointer", fontSize: "14px", textDecoration: "none", transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")} onMouseLeave={(e) => (e.currentTarget.style.color = "#B0B8C1")}>
                  {item}
                </a>
              ))}
            </nav>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button onClick={() => navigate("/admin/login")} style={{ background: "none", border: "1px solid #B0B8C1", color: "#B0B8C1", padding: "8px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600, transition: "all 0.2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#fff"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#B0B8C1"; (e.currentTarget as HTMLElement).style.color = "#B0B8C1"; }}>
              دخول
            </button>
            <button onClick={() => navigate("/store")} style={{ background: "#FF9900", border: "none", color: "#131921", padding: "8px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 700, transition: "all 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#FFB84D"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "#FF9900"}>
              اطلب الآن
            </button>
            <button onClick={() => setMobileMenu(!mobileMenu)} style={{ display: "none", background: "none", border: "none", cursor: "pointer", color: "#fff", padding: "8px" }} class="landing-mobile-btn">
              <span class="material-symbols-outlined">{mobileMenu ? "close" : "menu"}</span>
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div style={{ padding: "16px 24px", background: "#131921", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            {["المميزات", "الأسعار", "من نحن", "اتصل بنا"].map((item, i) => (
              <div key={item}><a onClick={() => scrollTo(["features", "pricing", "about", "contact"][i])} style={{ display: "block", color: "#B0B8C1", padding: "12px 0", cursor: "pointer", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{item}</a></div>
            ))}
          </div>
        )}
      </header>

      <section style={{ padding: "160px 24px 100px", background: "linear-gradient(135deg, #131921 0%, #1A2A3A 50%, #131921 100%)", minHeight: "80vh", display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center" }} class="landing-hero">
          <div>
            <div style={{ background: "rgba(255,153,0,0.1)", color: "#FF9900", display: "inline-block", padding: "6px 16px", borderRadius: "9999px", fontSize: "13px", fontWeight: 700, marginBottom: "24px" }}>منصة التجارة الإلكترونية الأولى في مصر</div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "48px", fontWeight: 800, color: "#fff", lineHeight: "1.2", margin: "0 0 24px", letterSpacing: "-0.02em" }} class="hero-title">
              حل متكامل لإدارة<br />متجرك الإلكتروني
            </h1>
            <p style={{ fontSize: "18px", color: "#B0B8C1", lineHeight: "1.8", margin: "0 0 40px", maxWidth: "500px" }}>
              منصة سحابية متكاملة لإدارة المنتجات والطلبات والعملاء. صممت خصيصاً للتجار في مصر والعالم العربي.
            </p>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <button onClick={() => navigate("/store")} style={{ background: "#FF9900", border: "none", color: "#131921", padding: "14px 32px", borderRadius: "12px", fontSize: "16px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(255,153,0,0.3)", transition: "all 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.transform = ""}>
                ابدأ الطلب الآن
              </button>
              <button onClick={() => scrollTo("features")} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "14px 32px", borderRadius: "12px", fontSize: "16px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}>
                اعرف المزيد
              </button>
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "24px", border: "1px solid rgba(255,255,255,0.1)", padding: "40px", textAlign: "center" }} class="hero-visual">
            <div style={{ fontSize: "80px", marginBottom: "24px" }}>🛍️</div>
            <div style={{ color: "#fff", fontSize: "14px", opacity: 0.7 }}>لوحة تحكم ذكية | إدارة المخزون | تقارير فورية</div>
          </div>
        </div>
      </section>

      <section id="features" style={{ padding: "100px 24px", background: "#fff" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "36px", fontWeight: 700, margin: "0 0 16px" }}>مميزات المنصة</h2>
          <p style={{ fontSize: "16px", color: "#565959", maxWidth: "600px", margin: "0 auto 60px" }}>كل ما تحتاجه لإدارة متجرك الإلكتروني في مكان واحد</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }} class="features-grid">
            {[
              { icon: "📦", title: "إدارة المنتجات", desc: "أضف منتجات غير محدودة مع صور وتفاصيل دقيقة وأسعار متدرجة حسب الكمية" },
              { icon: "📋", title: "معالجة الطلبات", desc: "تتبع الطلبات من الاستلام إلى التوصيل مع تحديث الحالة آلياً" },
              { icon: "👥", title: "قاعدة العملاء", desc: "سجل شامل للعملاء مع متابعة تاريخ الطلبات وسجل التواصل" },
              { icon: "📊", title: "التقارير والتحليلات", desc: "تقارير فورية عن المبيعات والأداء مع تحليل دقيق للبيانات" },
              { icon: "🏪", title: "متاجر متعددة", desc: "إدارة عدة متاجر من لوحة تحكم واحدة مع عزل كامل للبيانات" },
              { icon: "📱", title: "تجربة الجوال", desc: "واجهة متجاوبة تعمل على جميع الأجهزة مع تجربة مستخدم ممتازة" },
            ].map((feat) => (
              <div key={feat.title} style={{ padding: "32px", borderRadius: "16px", border: "1px solid #EAEDED", textAlign: "right", transition: "all 0.2s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#FF9900"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#EAEDED"; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}>
                <span style={{ fontSize: "40px" }}>{feat.icon}</span>
                <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "16px 0 8px" }}>{feat.title}</h3>
                <p style={{ fontSize: "14px", color: "#565959", lineHeight: "1.7", margin: 0 }}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" style={{ padding: "100px 24px", background: "#F6F8F8" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "36px", fontWeight: 700, margin: "0 0 16px" }}>باقات الأسعار</h2>
          <p style={{ fontSize: "16px", color: "#565959", maxWidth: "600px", margin: "0 auto 60px" }}>اختر الباقة المناسبة لاحتياجات عملك</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", alignItems: "start" }} class="pricing-grid">
            {[
              { name: "ستارتر", price: "999", popular: false, features: ["منتجات غير محدودة", "متجر واحد", "دعم عبر البريد", "تحديثات يومية"], cta: "ابدأ مجاناً" },
              { name: "بروفيشنال", price: "1,999", popular: true, features: ["منتجات غير محدودة", "متاجر غير محدودة", "دعم فوري", "تقارير متقدمة", "استضافة مجانية"], cta: "ابدأ الآن", badge: "الأكثر طلباً" },
              { name: "إنتربرايز", price: "مخصص", popular: false, features: ["كل ميزات بروفيشنال", "تكامل مخصص", "مدير حساب مخصص", "تدريب الفريق", "SLA مضمون"], cta: "اتصل بالمبيعات" },
            ].map((plan) => (
              <div key={plan.name} style={{ background: "#fff", borderRadius: "16px", border: plan.popular ? "2px solid #FF9900" : "1px solid #DDDDDD", padding: "40px 32px", textAlign: "center", position: "relative", boxShadow: plan.popular ? "0 8px 24px rgba(255,153,0,0.15)" : "0 2px 8px rgba(0,0,0,0.04)" }}>
                {plan.badge && <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: "#FF9900", color: "#131921", padding: "4px 20px", borderRadius: "9999px", fontSize: "12px", fontWeight: 800 }}>{plan.badge}</div>}
                <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px" }}>{plan.name}</h3>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "40px", fontWeight: 800, color: "#131921", margin: "16px 0" }}>{plan.price === "مخصص" ? plan.price : `${plan.price} ج.م`}</div>
                {plan.price !== "مخصص" && <p style={{ fontSize: "14px", color: "#565959", margin: "-8px 0 24px" }}>/ شهرياً</p>}
                <div style={{ textAlign: "right", marginBottom: "32px" }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", fontSize: "14px", color: "#565959" }}>
                      <span style={{ color: "#067D62" }}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate("/store")} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: plan.popular ? "#FF9900" : "#131921", color: plan.popular ? "#131921" : "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" style={{ padding: "100px 24px", background: "#fff" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "36px", fontWeight: 700, margin: "0 0 16px" }}>ماذا يقول عملاؤنا</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", marginTop: "48px" }} class="testimonials-grid">
            {[
              { name: "أحمد الرشيد", company: "بنطلون الساحل", quote: "المنصة غيرت طريقة إدارة متجري بالكامل. أقدر أتابع الطلبات والمخزون من أي مكان!" },
              { name: "محمود مالك", company: "مالك ستور", quote: "أفضل منصة إدارة متاجر استخدمتها. سهلة وقوية وفيها كل اللي محتاجه." },
              { name: "سارة البكر", company: "منصة ALFA", quote: "تقارير المبيعات والتحليلات ساعدتني أتخذ قرارات أدق لتنمية أعمالي." },
            ].map((t) => (
              <div key={t.name} style={{ padding: "32px", borderRadius: "16px", border: "1px solid #EAEDED", textAlign: "right", background: "#F6F8F8" }}>
                <div style={{ fontSize: "32px", color: "#FF9900", marginBottom: "16px" }}>"</div>
                <p style={{ fontSize: "14px", lineHeight: "1.8", color: "#565959", marginBottom: "24px" }}>{t.quote}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#FF9900", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "16px" }}>{t.name[0]}</div>
                  <div><div style={{ fontWeight: 700, fontSize: "14px" }}>{t.name}</div><div style={{ fontSize: "12px", color: "#565959" }}>{t.company}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" style={{ padding: "100px 24px", background: "#F6F8F8" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "36px", fontWeight: 700, textAlign: "center", margin: "0 0 48px" }}>الأسئلة الشائعة</h2>
          {[
            { q: "كم تكلفة الاشتراك في المنصة؟", a: "نقدم 14 يوماً تجريبياً مجاناً بدون بطاقة ائتمان. بعد ذلك، يمكنك اختيار الباقة المناسبة لك." },
            { q: "هل يمكنني تخصيص متجري؟", a: "نعم، يمكنك تخصيص المتجر بشعارك وألوانك وعلامتك التجارية. كما ندعم النطاقات المخصصة." },
            { q: "ما طرق الدفع المتاحة؟", a: "ندعم طرق الدفع المحلية والعالمية. سيتم إضافة المزيد من خيارات الدفع قريباً." },
            { q: "كيف ألغي اشتراكي؟", a: "يمكنك الإلغاء في أي وقت من لوحة التحكم. لا توجد عقود طويلة الأجل أو رسوم إلغاء." },
          ].map((faq, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: "12px", marginBottom: "12px", border: "1px solid #EAEDED", overflow: "hidden" }}>
              <div onClick={() => setActiveFaq(activeFaq === i ? null : i)} style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontWeight: 600, fontSize: "14px" }}>
                <span>{faq.q}</span>
                <span class="material-symbols-outlined" style={{ transition: "transform 0.2s", transform: activeFaq === i ? "rotate(180deg)" : "" }}>expand_more</span>
              </div>
              {activeFaq === i && <div style={{ padding: "0 24px 20px", fontSize: "14px", color: "#565959", lineHeight: "1.8", borderTop: "1px solid #EAEDED", paddingTop: "20px" }}>{faq.a}</div>}
            </div>
          ))}
        </div>
      </section>

      <section id="contact" style={{ padding: "100px 24px", background: "linear-gradient(135deg, #131921 0%, #1A2A3A 100%)", textAlign: "center" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "36px", fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>جهز لتطوير أعمالك؟</h2>
          <p style={{ fontSize: "16px", color: "#B0B8C1", marginBottom: "40px" }}>انضم إلى مئات التجار الناجحين في إدارة أعمالهم بكفاءة</p>
          <button onClick={() => navigate("/store")} style={{ background: "#FF9900", border: "none", color: "#131921", padding: "16px 48px", borderRadius: "12px", fontSize: "18px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(255,153,0,0.3)", transition: "all 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.transform = ""}>
            ابدأ الطلب الآن
          </button>
        </div>
      </section>

      <footer style={{ background: "#131921", padding: "48px 24px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "40px" }} class="footer-grid">
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 800, color: "#FEBD69", marginBottom: "16px" }}>M&K Store</div>
            <p style={{ fontSize: "13px", color: "#B0B8C1", lineHeight: "1.8" }}>منصة متكاملة لإدارة المتاجر الإلكترونية في مصر والعالم العربي.</p>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#fff", marginBottom: "16px", fontSize: "14px" }}>روابط سريعة</div>
            {["المميزات", "الأسعار", "من نحن", "اتصل بنا"].map((item, i) => (
              <div key={item}><a onClick={() => scrollTo(["features", "pricing", "about", "contact"][i])} style={{ color: "#B0B8C1", fontSize: "13px", cursor: "pointer", display: "block", padding: "4px 0", textDecoration: "none" }}>{item}</a></div>
            ))}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#fff", marginBottom: "16px", fontSize: "14px" }}>تواصل معنا</div>
            <div style={{ fontSize: "13px", color: "#B0B8C1", lineHeight: "2" }}>info@mkstore.com<br />+201234567890<br />القاهرة، مصر</div>
          </div>
        </div>
        <div style={{ maxWidth: "1200px", margin: "32px auto 0", padding: "24px 0 0", borderTop: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "#565959", margin: 0 }}>© 2025 M&K Store. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  );
}
