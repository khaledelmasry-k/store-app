import { useEffect, useState } from "preact/compat";
import { api } from "../services/api";

export default function StoreLinkRedirect() {
  const [msg, setMsg] = useState("جاري التحويل...");

  useEffect(() => {
    const slug = window.location.pathname.replace(/^\/go\//, "");
    if (!slug) { setMsg("رابط غير صالح"); return; }
    api.get<{
      storeRef: string; sellerId?: string; landingPageId?: string; landingPageSlug?: string;
      utmSource?: string; utmMedium?: string; utmCampaign?: string; id?: string;
    }>(`/orders/links/resolve/${slug}`)
      .then((link) => {
        let url = `/store/${link.storeRef}`;
        const q: string[] = [];
        if (link.sellerId) q.push(`seller=${link.sellerId}`);
        if (link.landingPageId) q.push(`landing=${link.landingPageId}&landingSlug=${encodeURIComponent(link.landingPageSlug || "")}`);
        if (link.id) q.push(`link=${link.id}`);
        if (link.utmSource) q.push(`utm_source=${encodeURIComponent(link.utmSource)}`);
        if (link.utmMedium) q.push(`utm_medium=${encodeURIComponent(link.utmMedium)}`);
        if (link.utmCampaign) q.push(`utm_campaign=${encodeURIComponent(link.utmCampaign)}`);
        if (q.length) url += `?${q.join("&")}`;
        window.location.href = url;
      })
      .catch(() => setMsg("الرابط غير موجود"));
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <p style={{ fontSize: "18px", color: "#565959" }}>{msg}</p>
    </div>
  );
}
