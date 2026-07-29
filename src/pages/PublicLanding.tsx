import { useEffect, useState } from "preact/compat";
import { api, getImageUrl } from "../services/api";

interface StoreInfo { name: string; tagLine: string | null; logo: string | null; primaryColor: string | null; }

type SectionType = "hero" | "features" | "products" | "cta" | "footer" | "testimonials" | "faq" | "contact";

interface Section {
  type: SectionType;
  content: Record<string, string>;
}

export default function PublicLanding() {
  const slug = window.location.pathname.replace(/^\/p\//, "");
  const [page, setPage] = useState<{ name: string; sections: Section[]; store: StoreInfo } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<{ name: string; sections: Section[]; store: StoreInfo }>(`/merchant/landing-pages/public/${slug}`)
      .then(setPage)
      .catch(() => setError("الصفحة غير موجودة"));
  }, [slug]);

  if (error) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <p style={{ fontSize: "18px", color: "#565959" }}>{error}</p>
    </div>
  );

  if (!page) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <p style={{ fontSize: "18px", color: "#565959" }}>جاري التحميل...</p>
    </div>
  );

  const { store } = page;
  const primaryColor = store.primaryColor || "#FF9900";

  return (
    <div style={{ fontFamily: "'Noto Sans Arabic', sans-serif", background: "#fff", minHeight: "100vh" }}>
      {/* Store header */}
      <header style={{ background: "#131921", color: "#fff", padding: "12px 24px", display: "flex", alignItems: "center", gap: "12px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {store.logo && <img src={getImageUrl(store.logo)} alt="logo" style={{ height: "36px", borderRadius: "4px" }} />}
          <div>
            <span style={{ fontWeight: 700, fontSize: "18px" }}>{store.name}</span>
            {store.tagLine && <span style={{ fontSize: "12px", opacity: 0.7, display: "block" }}>{store.tagLine}</span>}
          </div>
        </div>
      </header>

      {/* Sections */}
      {page.sections.map((sec, idx) => {
        switch (sec.type) {
          case "hero":
            return (
              <section key={idx} style={{
                background: `linear-gradient(135deg, ${primaryColor}22, ${primaryColor}44)`,
                padding: "80px 24px", textAlign: "center",
              }}>
                {sec.content.imageUrl && (
                  <img src={getImageUrl(sec.content.imageUrl)} alt="" style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: "12px", marginBottom: "24px", objectFit: "cover" }} />
                )}
                <h1 style={{ fontSize: "36px", fontWeight: 800, color: "#131921", margin: "0 0 16px" }}>{sec.content.headline}</h1>
                {sec.content.subtext && <p style={{ fontSize: "18px", color: "#565959", margin: "0 0 24px", maxWidth: "600px", marginLeft: "auto", marginRight: "auto" }}>{sec.content.subtext}</p>}
                {sec.content.buttonText && (
                  <a href={sec.content.buttonUrl || "#"}
                    style={{ display: "inline-block", padding: "14px 36px", background: primaryColor, color: "#fff", borderRadius: "8px", fontWeight: 700, fontSize: "16px", textDecoration: "none" }}>
                    {sec.content.buttonText}
                  </a>
                )}
              </section>
            );
          case "features":
            let items: string[] = [];
            try { items = JSON.parse(sec.content.items || "[]"); } catch {}
            return (
              <section key={idx} style={{ padding: "64px 24px", textAlign: "center" }}>
                {sec.content.title && <h2 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 40px", color: "#131921" }}>{sec.content.title}</h2>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "24px", maxWidth: "900px", margin: "0 auto" }}>
                  {items.map((item, i) => (
                    <div key={i} style={{ padding: "24px", borderRadius: "12px", border: `1px solid ${primaryColor}33`, background: "#fff" }}>
                      <span class="material-symbols-outlined" style={{ fontSize: "36px", color: primaryColor, marginBottom: "12px" }}>check_circle</span>
                      <p style={{ fontWeight: 600, margin: 0 }}>{item}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          case "cta":
            return (
              <section key={idx} style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`, padding: "64px 24px", textAlign: "center" }}>
                <h2 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: "0 0 24px" }}>{sec.content.headline}</h2>
                {sec.content.buttonText && (
                  <a href={sec.content.buttonUrl || "#"}
                    style={{ display: "inline-block", padding: "14px 36px", background: "#fff", color: primaryColor, borderRadius: "8px", fontWeight: 700, fontSize: "16px", textDecoration: "none" }}>
                    {sec.content.buttonText}
                  </a>
                )}
              </section>
            );
          case "testimonials": {
            let items: { name: string; text: string; rating?: string }[] = [];
            try { items = JSON.parse(sec.content.items || "[]"); } catch {}
            return (
              <section key={idx} style={{ padding: "64px 24px", textAlign: "center", background: "#F6F8F8" }}>
                {sec.content.title && <h2 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 40px", color: "#131921" }}>{sec.content.title}</h2>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px", maxWidth: "900px", margin: "0 auto" }}>
                  {items.map((item, i) => (
                    <div key={i} style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid #DDDDDD", textAlign: "right" }}>
                      <div style={{ color: primaryColor, fontSize: "18px", marginBottom: "8px" }}>
                        {Array.from({ length: parseInt(item.rating || "5") || 5 }, (_, ri) => (
                          <span key={ri} class="material-symbols-outlined" style={{ fontSize: "18px", verticalAlign: "middle" }}>star</span>
                        ))}
                      </div>
                      <p style={{ fontSize: "14px", color: "#565959", lineHeight: 1.6, margin: "0 0 12px" }}>"{item.text}"</p>
                      <p style={{ fontWeight: 700, fontSize: "14px", margin: 0, color: "#131921" }}>— {item.name}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          }
          case "faq": {
            let qa: { q: string; a: string }[] = [];
            try { qa = JSON.parse(sec.content.items || "[]"); } catch {}
            return (
              <section key={idx} style={{ padding: "64px 24px", maxWidth: "700px", margin: "0 auto" }}>
                {sec.content.title && <h2 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 32px", textAlign: "center", color: "#131921" }}>{sec.content.title}</h2>}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {qa.map((item, i) => (
                    <details key={i} style={{ border: "1px solid #DDDDDD", borderRadius: "8px", overflow: "hidden" }}>
                      <summary style={{ padding: "14px 16px", fontWeight: 700, fontSize: "14px", cursor: "pointer", background: "#FAFAFA", color: "#131921" }}>
                        {item.q}
                      </summary>
                      <p style={{ padding: "14px 16px", margin: 0, fontSize: "14px", color: "#565959", lineHeight: 1.6 }}>{item.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            );
          }
          case "contact":
            return (
              <section key={idx} style={{ padding: "64px 24px", background: "#F6F8F8", textAlign: "center" }}>
                {sec.content.title && <h2 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 40px", color: "#131921" }}>{sec.content.title}</h2>}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "400px", margin: "0 auto", alignItems: "center" }}>
                  {sec.content.phone && <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                    <span class="material-symbols-outlined" style={{ color: primaryColor }}>phone</span>
                    <a href={`tel:${sec.content.phone}`} style={{ color: "#007185", textDecoration: "none" }}>{sec.content.phone}</a>
                  </div>}
                  {sec.content.whatsapp && <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                    <span class="material-symbols-outlined" style={{ color: "#25D366" }}>chat</span>
                    <a href={`https://wa.me/${sec.content.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" style={{ color: "#007185", textDecoration: "none" }}>{sec.content.whatsapp}</a>
                  </div>}
                  {sec.content.email && <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                    <span class="material-symbols-outlined" style={{ color: primaryColor }}>mail</span>
                    <a href={`mailto:${sec.content.email}`} style={{ color: "#007185", textDecoration: "none" }}>{sec.content.email}</a>
                  </div>}
                  {sec.content.address && <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                    <span class="material-symbols-outlined" style={{ color: primaryColor }}>location_on</span>
                    <span style={{ color: "#565959" }}>{sec.content.address}</span>
                  </div>}
                </div>
              </section>
            );
          case "footer":
            return (
              <footer key={idx} style={{ background: "#131921", color: "#B0B8C1", padding: "32px 24px", textAlign: "center", fontSize: "14px" }}>
                <p style={{ margin: 0 }}>{sec.content.text || "جميع الحقوق محفوظة"}</p>
              </footer>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
