"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Swal from "sweetalert2";

const ADMIN_EMAIL = "samirrivasmena@gmail.com".toLowerCase();

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
      <path
        d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 12l1.8 1.8L15 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9.5 12a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.6 10.6A2.5 2.5 0 0012 17a2.5 2.5 0 002.4-3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5.2 8.2C3.9 9.4 3 12 3 12s3.5 7 9 7c1.1 0 2.1-.2 3-.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9 5.5A9.9 9.9 0 0112 5c6.5 0 10 7 10 7s-1 2.4-2.8 4.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const iniciarSesion = async (e) => {
    e.preventDefault();

    const emailLimpio = email.trim().toLowerCase();
    const passwordLimpia = password.trim();

    if (!emailLimpio || !passwordLimpia) {
      await Swal.fire({
        icon: "warning",
        title: "Campos incompletos",
        text: "Debes ingresar tu correo y contraseña",
      });
      return;
    }

    if (loading) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailLimpio,
        password: passwordLimpia,
      });

      if (error) {
        await Swal.fire({
          icon: "error",
          title: "Error de acceso",
          text: "Correo o contraseña inválidos",
        });
        return;
      }

      const userEmail = data?.user?.email?.toLowerCase();

      if (userEmail !== ADMIN_EMAIL) {
        await supabase.auth.signOut();

        await Swal.fire({
          icon: "error",
          title: "Acceso denegado",
          text: "Este usuario no tiene permiso para entrar al panel admin",
        });

        setPassword("");
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Bienvenido",
        text: "Acceso concedido al panel admin",
        timer: 1200,
        showConfirmButton: false,
      });

      setPassword("");
      router.replace("/admin");
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
        background:
          "radial-gradient(circle at top, rgba(59,130,246,0.14), transparent 35%), linear-gradient(135deg, #0f172a, #111827 55%, #0b1220)",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "rgba(255,255,255,0.96)",
          borderRadius: "26px",
          padding: "34px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.22)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "18px",
              margin: "0 auto 14px",
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, #111827, #1f2937)",
              color: "#fff",
              boxShadow: "0 12px 30px rgba(17,24,39,0.28)",
            }}
          >
            <ShieldIcon />
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "30px",
              fontWeight: 800,
              color: "#111827",
              letterSpacing: "-0.03em",
            }}
          >
            Admin Login
          </h1>

          <p style={{ marginTop: "8px", color: "#6b7280", lineHeight: 1.5 }}>
            Acceso exclusivo para administrador
          </p>
        </div>

        <form onSubmit={iniciarSesion} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "700",
                color: "#111827",
              }}
            >
              Correo
            </label>
            <input
              type="email"
              placeholder="Tu correo admin"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              spellCheck={false}
              autoCapitalize="none"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "14px",
                border: "1px solid #d1d5db",
                outline: "none",
                fontSize: "15px",
                color: "#111827",
                background: "#fff",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "700",
                color: "#111827",
              }}
            >
              Contraseña
            </label>

            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{
                  width: "100%",
                  padding: "14px 52px 14px 16px",
                  borderRadius: "14px",
                  border: "1px solid #d1d5db",
                  outline: "none",
                  fontSize: "15px",
                  color: "#111827",
                  background: "#fff",
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  color: "#6b7280",
                  cursor: "pointer",
                  padding: "4px",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: "14px",
              border: "none",
              background: loading
                ? "linear-gradient(135deg, #6b7280, #9ca3af)"
                : "linear-gradient(135deg, #111827, #0f172a)",
              color: "#fff",
              fontWeight: "800",
              fontSize: "16px",
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: "4px",
              boxShadow: loading ? "none" : "0 12px 28px rgba(17,24,39,0.28)",
            }}
          >
            {loading ? "Verificando..." : "Entrar al panel admin"}
          </button>
        </form>

        <p
          style={{
            marginTop: "16px",
            textAlign: "center",
            fontSize: "12px",
            color: "#6b7280",
          }}
        >
          Solo personal autorizado
        </p>
      </div>
    </div>
  );
}