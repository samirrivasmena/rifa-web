"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { supabase } from "../../lib/supabase";

export function useAdminAuth() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [accesoPermitido, setAccesoPermitido] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    let mounted = true;

    const verificarAcceso = async () => {
      try {
        setAuthLoading(true);

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        const token = session?.access_token;
        const user = session?.user || null;

        if (error || !token || !user) {
          if (!mounted) return;
          setAccesoPermitido(false);
          router.replace("/admin-login");
          return;
        }

        const res = await fetch("/api/admin-check", {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok || !data?.ok) {
          await supabase.auth.signOut();

          if (!mounted) return;

          await Swal.fire({
            icon: "error",
            title: "Acceso denegado",
            text: "No tienes permiso para entrar al panel de administración",
          });

          setAccesoPermitido(false);
          router.replace("/admin-login");
          return;
        }

        if (!mounted) return;

        setAdminEmail(user.email || "");
        setAccesoPermitido(true);
      } catch (error) {
        console.error("Error verificando acceso:", error);

        if (!mounted) return;

        setAccesoPermitido(false);
        router.replace("/admin-login");
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    verificarAcceso();

    return () => {
      mounted = false;
    };
  }, [router]);

  const cerrarSesion = async () => {
    const confirmar = await Swal.fire({
      title: "¿Cerrar sesión?",
      text: "Se cerrará tu sesión de administrador",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, salir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#7f1d1d",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmar.isConfirmed) return;

    await supabase.auth.signOut();
    router.replace("/admin-login");
  };

  return {
    authLoading,
    accesoPermitido,
    adminEmail,
    cerrarSesion,
  };
}