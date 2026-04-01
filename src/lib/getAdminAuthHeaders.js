import { supabase } from "./supabase";

export async function getAdminAuthHeaders() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;

    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  } catch (error) {
    console.error("Error obteniendo headers de admin:", error);
    return {
      "Content-Type": "application/json",
    };
  }
}