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
        let url = `/store?ref=${link.storeRef}`;
        if (link.sellerId) url += `&seller=${link.sellerId}`;
        if (link.landingPageId) url += `&landing=${link.landingPageId}&landingSlug=${link.landingPageSlug || ""}`;
        if (link.id) url += `&link=${link.id}`;
        if (link.utmSource) url += `&utm_source=${link.utmSource}`;
        if (link.utmMedium) url += `&utm_medium=${link.utmMedium}`;
        if (link.utmCampaign) url += `&utm_campaign=${link.utmCampaign}`;
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
