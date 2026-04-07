"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { supabase } from "../../lib/supabase";
import { ADMIN_EMAIL } from "../../lib/admin/adminConstants";

export function useAdminAuth() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [accesoPermitido, setAccesoPermitido] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    const verificarAcceso = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          router.replace("/admin-login");
          return;
        }

        const email = user.email?.toLowerCase();

        if (email !== ADMIN_EMAIL.toLowerCase()) {
          await supabase.auth.signOut();

          await Swal.fire({
            icon: "error",
            title: "Acceso denegado",
            text: "No tienes permiso para entrar al panel de administración",
          });

          router.replace("/admin-login");
          return;
        }

        setAdminEmail(user.email || "");
        setAccesoPermitido(true);
      } catch (error) {
        console.error("Error verificando acceso:", error);
        router.replace("/admin-login");
      } finally {
        setAuthLoading(false);
      }
    };

    verificarAcceso();
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