import { useState, FormEvent } from "preact/compat";
import { useLocation } from "wouter";
import { api } from "../services/api";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.post<{ token: string; admin: any }>("/admin/login", { username, password });
      localStorage.setItem("token", result.token);
      navigate("/admin");
    } catch (err: any) {
      setError(err.message || "خطأ في اسم المستخدم أو كلمة المرور");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <div style={{ marginBottom: "32px", textAlign: "center" }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 800, color: "#131921", letterSpacing: "-0.02em" }}>M&K Store</span>
        </div>
        <div style={{ background: "#fff", maxWidth: "360px", width: "100%", padding: "32px 24px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)", border: "1px solid #DDDDDD" }}>
          <div style={{ fontSize: "40px", marginBottom: "16px", textAlign: "center" }}>🏪</div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0F1111", marginBottom: "4px", textAlign: "center" }}>M&K Store</h1>
          <p style={{ fontSize: "14px", color: "#565959", marginBottom: "24px", textAlign: "center" }}>لوحة تحكم الإدارة — يرجى تسجيل الدخول</p>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="username" style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#0F1111", marginBottom: "4px" }}>اسم المستخدم</label>
              <input type="text" name="username" id="username" class="amazon-input" value={username} onChange={(e) => setUsername((e.target as HTMLInputElement).value)} placeholder="أدخل اسم المستخدم" required />
            </div>
            <div style={{ marginBottom: "8px" }}>
              <label htmlFor="password" style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#0F1111", marginBottom: "4px" }}>كلمة المرور</label>
              <input type="password" name="password" id="password" class="amazon-input" value={password} onChange={(e) => setPassword((e.target as HTMLInputElement).value)} placeholder="أدخل كلمة المرور" required />
            </div>
            {error && (
              <div style={{ color: "#B12704", fontSize: "13px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "4px", marginTop: "8px" }}>
                <span class="material-symbols-outlined" style={{ fontSize: "16px" }}>error</span>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              style={{
                width: "100%", height: "48px", background: loading ? "#FF9900" : "#FF9900", color: "#0F1111",
                fontSize: "16px", fontWeight: 700, border: "none", borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 5px 0 rgba(213,217,217,0.5)", opacity: loading ? 0.7 : 1,
              }}>
              {loading ? "جاري..." : "تسجيل الدخول"}
            </button>
          </form>
          <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #DDDDDD" }}>
            <a href="#" style={{ color: "#007185", fontSize: "14px", display: "block", textAlign: "center" }}>نسيت كلمة المرور؟</a>
          </div>
        </div>
        <p style={{ fontSize: "12px", color: "#565959", marginTop: "24px", textAlign: "center" }}>© ٢٠٢٤ جميع الحقوق محفوظة لـ M&K Store</p>
      </div>
    </div>
  );
}
