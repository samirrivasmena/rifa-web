"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Swal from "sweetalert2";

const ADMIN_EMAIL = "samirrivasmena@gmail.com";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const iniciarSesion = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Campos incompletos",
        text: "Debes ingresar tu correo y contraseña",
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        await Swal.fire({
          icon: "error",
          title: "Error de acceso",
          text: error.message || "No se pudo iniciar sesión",
        });
        return;
      }

      const userEmail = data?.user?.email?.toLowerCase();

      if (userEmail !== ADMIN_EMAIL.toLowerCase()) {
        await supabase.auth.signOut();

        await Swal.fire({
          icon: "error",
          title: "Acceso denegado",
          text: "Este usuario no tiene permiso para entrar al panel admin",
        });

        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Bienvenido",
        text: "Acceso concedido al panel admin",
        timer: 1200,
        showConfirmButton: false,
      });

      router.push("/admin");
    } catch (error) {
      console.error("Error inesperado login:", error);

      await Swal.fire({
        icon: "error",
        title: "Error inesperado",
        text: error?.message || "Ocurrió un error al iniciar sesión",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg, #0f172a, #1e293b)",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h1 style={{ margin: 0, fontSize: "30px", color: "#111827" }}>
            Admin Login
          </h1>
          <p style={{ marginTop: "8px", color: "#6b7280" }}>
            Acceso exclusivo para administrador
          </p>
        </div>

        <form onSubmit={iniciarSesion} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
                color: "#111827",
              }}
            >
              Correo
            </label>
            <input
              type="email"
              placeholder="samirrivasmena@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "14px",
                border: "1px solid #d1d5db",
                outline: "none",
                fontSize: "15px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
                color: "#111827",
              }}
            >
              Contraseña
            </label>
            <input
              type="password"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "14px",
                border: "1px solid #d1d5db",
                outline: "none",
                fontSize: "15px",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: "14px",
              border: "none",
              background: loading ? "#9ca3af" : "#111827",
              color: "#fff",
              fontWeight: "700",
              fontSize: "16px",
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: "4px",
            }}
          >
            {loading ? "Ingresando..." : "Entrar al panel admin"}
          </button>
        </form>
      </div>
    </div>
  );
}