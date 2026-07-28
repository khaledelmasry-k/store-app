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
      setError(err.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", direction: "rtl", background: "#fbf8ff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ background: "white", borderRadius: "8px", padding: "32px 24px", maxWidth: "360px", width: "100%", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "40px", marginBottom: "8px" }}>🏪</div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>المتجر الفاخر</h1>
          <p style={{ fontSize: "14px", color: "#71717a", margin: "4px 0 0" }}>تسجيل الدخول لإدارة متجرك</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="username" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>اسم المستخدم</label>
            <input type="text" name="username" id="username" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label htmlFor="password" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>كلمة المرور</label>
            <input type="password" name="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }} />
          </div>

          {error && <p style={{ color: "#ba1a1a", fontSize: "14px", textAlign: "center", margin: "0 0 16px" }}>{error}</p>}

          <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", background: "black", color: "white", border: "none", borderRadius: "4px", fontSize: "16px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "جاري..." : "دخول"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#71717a", marginTop: "24px" }}>© ٢٠٢٤ جميع الحقوق محفوظة</p>
      </div>
    </div>
  );
}
