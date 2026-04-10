"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Swal from "sweetalert2";
import HomeEventosPreview from "@/components/home/HomeEventosPreview";
import VerifyTicketsModal from "@/components/shared/VerifyTicketsModal";
import PublicTopbar from "@/components/shared/PublicTopbar";
import { paymentMethodsConfig, paymentMethodsList } from "@/lib/paymentMethods";
import { validarEmail } from "@/lib/verifyTickets";
import AppPayButton from "@/components/shared/AppPayButton";
import PurchaseGuideFloating from "@/components/shared/PurchaseGuideFloating";

export default function HomePageClient() {
  const searchParams = useSearchParams();
  const rifaDesdeQuery = searchParams.get("rifa");

  const [tickets, setTickets] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("Binance");
  const [showSecondImage, setShowSecondImage] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [loadingCompra, setLoadingCompra] = useState(false);
  const [capturaInmediata, setCapturaInmediata] = useState(false);

  const [rifaActiva, setRifaActiva] = useState(null);
  const [loadingRifa, setLoadingRifa] = useState(true);
  const [rifas, setRifas] = useState([]);

  const [previewUrl, setPreviewUrl] = useState("");
  const [showAppPayModal, setShowAppPayModal] = useState(false);

  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    telefono: "",
    referencia: "",
    comprobante: null,
    codigoPais: "+58",
  });

  const esPublicada = (value) =>
    value === true || value === 1 || value === "1" || value === "true";

  const estaDisponibleParaCompra = (estado) =>
    ["activa", "disponible", "publicada"].includes(
      String(estado || "").toLowerCase()
    );

  useEffect(() => {
    const handleScroll = () => {
      setShowSecondImage(window.scrollY > 180);
    };

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setShowVerifyModal(false);
        setShowAppPayModal(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    const cargarRifa = async () => {
      try {
        setLoadingRifa(true);

        if (rifaDesdeQuery) {
          const resRifas = await fetch("/api/rifas-publicas", {
            method: "GET",
            cache: "no-store",
          });

          const dataRifas = await resRifas.json();

          if (!resRifas.ok) {
            console.error(dataRifas.error || "No se pudo cargar la lista de rifas");
            setRifaActiva(null);
            return;
          }

          const listaRifas = Array.isArray(dataRifas.rifas) ? dataRifas.rifas : [];

          const rifaEncontrada = listaRifas.find(
            (r) => String(r.id) === String(rifaDesdeQuery) && esPublicada(r.publicada)
          );

          if (!rifaEncontrada) {
            console.warn("No se encontró la rifa solicitada en la URL");
            setRifaActiva(null);
            return;
          }

          setRifaActiva(rifaEncontrada);
          return;
        }

        const res = await fetch("/api/rifa-activa", {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          console.error(data.error || "No se pudo cargar la rifa activa");
          setRifaActiva(null);
          return;
        }

        setRifaActiva(data.rifa || null);
      } catch (error) {
        console.error("Error cargando rifa:", error);
        setRifaActiva(null);
      } finally {
        setLoadingRifa(false);
      }
    };

    cargarRifa();
  }, [rifaDesdeQuery]);

  useEffect(() => {
    const scrollConOffset = (id, intentos = 0) => {
      const section = document.getElementById(id);

      if (!section) {
        if (intentos < 20) {
          setTimeout(() => {
            scrollConOffset(id, intentos + 1);
          }, 200);
        }
        return;
      }

      const isMobile = window.innerWidth <= 768;

      let offset = 110;

      if (id === "resultados-oficiales") {
        offset = isMobile ? 92 : 130;
      } else if (id === "boletos") {
        offset = isMobile ? 88 : 120;
      } else {
        offset = isMobile ? 82 : 110;
      }

      const top = section.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({
        top,
        behavior: "smooth",
      });

      section.classList.remove("boletos-highlight");

      if (
        ["inicio", "eventos", "boletos", "pagos", "contacto", "resultados-oficiales"].includes(id)
      ) {
        setTimeout(() => {
          section.classList.add("boletos-highlight");

          setTimeout(() => {
            section.classList.remove("boletos-highlight");
          }, 2200);
        }, 150);
      }
    };

    const hacerScrollAlHash = () => {
      const hash = window.location.hash;

      if (!hash) return;

      const id = hash.replace("#", "");
      if (!id) return;

      setTimeout(() => {
        scrollConOffset(id);
      }, 250);
    };

    hacerScrollAlHash();

    window.addEventListener("hashchange", hacerScrollAlHash);

    return () => {
      window.removeEventListener("hashchange", hacerScrollAlHash);
    };
  }, [rifaActiva, rifas]);

  useEffect(() => {
    const cargarRifas = async () => {
      try {
        const res = await fetch("/api/rifas-publicas", {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          console.error(data.error || "No se pudo cargar la lista de rifas");
          return;
        }

        setRifas(Array.isArray(data.rifas) ? data.rifas : []);
      } catch (error) {
        console.error("Error cargando rifas:", error);
      }
    };

    cargarRifas();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const rifasPublicadasOrdenadas = useMemo(() => {
    const publicadas = rifas.filter((r) => esPublicada(r.publicada));

    return [...publicadas].sort((a, b) => {
      const destacadaA = Boolean(a.destacada);
      const destacadaB = Boolean(b.destacada);

      if (destacadaA !== destacadaB) {
        return Number(destacadaB) - Number(destacadaA);
      }

      const fechaA = new Date(a.created_at || a.fecha_sorteo || 0).getTime();
      const fechaB = new Date(b.created_at || b.fecha_sorteo || 0).getTime();

      return fechaB - fechaA;
    });
  }, [rifas]);

  const precioPorTicketRaw = Number(rifaActiva?.precio_ticket);
  const precioPorTicket = Number.isFinite(precioPorTicketRaw) ? precioPorTicketRaw : 0;
  const totalPagar = tickets * precioPorTicket;

  const totalNumerosRaw = Number(
    rifaActiva?.cantidad_numeros ??
      rifaActiva?.total_tickets ??
      rifaActiva?.numeros_totales ??
      0
  );

  const ticketsVendidosRaw = Number(
    rifaActiva?.tickets_vendidos ??
      rifaActiva?.vendidos ??
      rifaActiva?.ticketsVendidos ??
      0
  );

  const totalNumeros = Number.isFinite(totalNumerosRaw) ? totalNumerosRaw : 0;
  const ticketsVendidos = Number.isFinite(ticketsVendidosRaw) ? ticketsVendidosRaw : 0;

  const porcentajeVendidoRaw = Number(
    rifaActiva?.porcentaje_vendido ??
      (totalNumeros > 0 ? (ticketsVendidos / totalNumeros) * 100 : 0)
  );

  const porcentajeVendido = Number.isFinite(porcentajeVendidoRaw)
    ? Math.min(porcentajeVendidoRaw, 100)
    : 0;

  const porcentajeVendidoTexto = `${porcentajeVendido.toFixed(1)}%`;
  const rifaCompleta = totalNumeros > 0 && ticketsVendidos >= totalNumeros;

  const nombreRifa = rifaActiva?.nombre || "";
  const descripcionRifa = rifaActiva?.descripcion || "";
  const premioPrincipal = rifaActiva?.premio || "";

  const imagenRifaPrincipal = rifaActiva?.portada_url || "";
  const imagenRifaScroll = rifaActiva?.portada_scroll_url || imagenRifaPrincipal;

  const fechaRifa =
    rifaActiva?.fecha_sorteo ||
    rifaActiva?.fecha ||
    rifaActiva?.fecha_rifa ||
    "";

  const horaRifa =
    rifaActiva?.hora_sorteo ||
    rifaActiva?.hora ||
    rifaActiva?.hora_rifa ||
    "";

  const premios = Array.isArray(rifaActiva?.premios)
    ? rifaActiva.premios
    : premioPrincipal
    ? [premioPrincipal]
    : [];

  const swalConfig = {
    background: "#1f1f1f",
    color: "#fff",
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#6b7280",
  };

  const copiarTexto = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      await Swal.fire({
        ...swalConfig,
        icon: "success",
        title: "Copiado",
        text: "Dato copiado al portapapeles.",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch {
      await Swal.fire({
        ...swalConfig,
        icon: "error",
        title: "No se pudo copiar",
        text: "Copia manualmente el dato.",
      });
    }
  };

  const limpiarArchivo = () => {
    setFormData((prev) => ({ ...prev, comprobante: null }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
  };

  const handleInputChange = async (e) => {
    const { name, value, files } = e.target;

    if (name === "comprobante") {
      const archivo = files?.[0] || null;

      if (!archivo) {
        limpiarArchivo();
        return;
      }

      const tiposPermitidos = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "application/pdf",
      ];

      const maxSize = 5 * 1024 * 1024;

      if (!tiposPermitidos.includes(archivo.type)) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Archivo no permitido",
          text: "Solo se permiten imágenes JPG, PNG, WEBP o PDF.",
        });

        limpiarArchivo();
        return;
      }

      if (archivo.size > maxSize) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Archivo muy pesado",
          text: "El comprobante no puede superar 5MB.",
        });

        limpiarArchivo();
        return;
      }

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      if (archivo.type !== "application/pdf") {
        setPreviewUrl(URL.createObjectURL(archivo));
      } else {
        setPreviewUrl("");
      }

      setFormData((prev) => ({ ...prev, comprobante: archivo }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const paymentMethods = paymentMethodsList;
  const metodoSeleccionado = paymentMethodsConfig[paymentMethod];
  const esPagoDigital = paymentMethod === "App Pay" || paymentMethod === "Google Pay";

  const registrarCompraAppPay = async ({
    referenciaPago,
    emailWallet = "",
    nombreWallet = "",
  }) => {
    if (loadingCompra) return;

    try {
      setLoadingCompra(true);

      const { nombre, email, telefono, codigoPais } = formData;
      const telefonoLimpio = telefono.replace(/[^\d]/g, "");

      if (!rifaActiva?.id) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Sin rifa disponible",
          text: "No hay una rifa disponible para registrar el pago",
        });
        return;
      }

      if (rifaCompleta) {
        await Swal.fire({
          ...swalConfig,
          icon: "info",
          title: "Boletos agotados",
          text: "Esta rifa ya alcanzó el 100% y no acepta más compras.",
        });
        return;
      }

      if (!estaDisponibleParaCompra(rifaActiva?.estado)) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Rifa no disponible",
          text: "Esta rifa no está disponible para compra en este momento",
        });
        return;
      }

      if (precioPorTicket <= 0) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Precio inválido",
          text: "Esta rifa no tiene un precio válido configurado",
        });
        return;
      }

      if (!telefono.trim() || telefonoLimpio.length < 8) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Teléfono requerido",
          text: "Debes ingresar tu teléfono válido para registrar la compra con App Pay",
        });
        return;
      }

      const nombreFinal = nombre.trim() || nombreWallet || "Pago App Pay";
      const emailFinal = email.trim() || emailWallet;

      if (!emailFinal || !validarEmail(emailFinal)) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Email requerido",
          text: "Debes ingresar un correo válido para registrar la compra con App Pay",
        });
        return;
      }

      const response = await fetch("/api/comprar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre: nombreFinal,
          email: emailFinal,
          telefono: `${codigoPais || "+58"} ${telefonoLimpio}`,
          referencia: referenciaPago || "APPPAY",
          tickets,
          totalPagar,
          paymentMethod: "App Pay",
          comprobanteUrl: "",
          rifaId: rifaActiva.id,
          capturaInmediata: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        await Swal.fire({
          ...swalConfig,
          icon: "error",
          title: "Error al registrar compra",
          text: data.error || "El pago fue exitoso pero no se pudo registrar la compra",
        });
        return;
      }

      await Swal.fire({
        ...swalConfig,
        icon: "success",
        title: "Pago realizado",
        text: "Tu compra con App Pay fue registrada correctamente.",
      });

      setFormData({
        nombre: "",
        email: "",
        telefono: "",
        referencia: "",
        comprobante: null,
        codigoPais: "+58",
      });

      setCapturaInmediata(false);
      setTickets(1);
      limpiarArchivo();
    } catch (error) {
      await Swal.fire({
        ...swalConfig,
        icon: "error",
        title: "Error inesperado",
        text: error?.message || "Ocurrió un error inesperado",
      });
    } finally {
      setLoadingCompra(false);
    }
  };

  const registrarCompraGooglePay = async ({
    referenciaPago,
    emailWallet = "",
    nombreWallet = "",
  }) => {
    if (loadingCompra) return;

    try {
      setLoadingCompra(true);

      const { nombre, email, telefono, codigoPais } = formData;
      const telefonoLimpio = telefono.replace(/[^\d]/g, "");

      if (!rifaActiva?.id) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Sin rifa disponible",
          text: "No hay una rifa disponible para registrar el pago",
        });
        return;
      }

      if (rifaCompleta) {
        await Swal.fire({
          ...swalConfig,
          icon: "info",
          title: "Boletos agotados",
          text: "Esta rifa ya alcanzó el 100% y no acepta más compras.",
        });
        return;
      }

      if (!estaDisponibleParaCompra(rifaActiva?.estado)) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Rifa no disponible",
          text: "Esta rifa no está disponible para compra en este momento",
        });
        return;
      }

      if (precioPorTicket <= 0) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Precio inválido",
          text: "Esta rifa no tiene un precio válido configurado",
        });
        return;
      }

      if (!telefono.trim() || telefonoLimpio.length < 8) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Teléfono requerido",
          text: "Debes ingresar tu teléfono válido para registrar la compra con Google Pay",
        });
        return;
      }

      const nombreFinal = nombre.trim() || nombreWallet || "Pago Google Pay";
      const emailFinal = email.trim() || emailWallet;

      if (!emailFinal || !validarEmail(emailFinal)) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Email requerido",
          text: "Debes ingresar un correo válido para registrar la compra con Google Pay",
        });
        return;
      }

      const response = await fetch("/api/comprar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre: nombreFinal,
          email: emailFinal,
          telefono: `${codigoPais || "+58"} ${telefonoLimpio}`,
          referencia: referenciaPago || "GOOGLEPAY",
          tickets,
          totalPagar,
          paymentMethod: "Google Pay",
          comprobanteUrl: "",
          rifaId: rifaActiva.id,
          capturaInmediata: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        await Swal.fire({
          ...swalConfig,
          icon: "error",
          title: "Error al registrar compra",
          text: data.error || "No se pudo registrar la compra",
        });
        return;
      }

      await Swal.fire({
        ...swalConfig,
        icon: "success",
        title: "Compra registrada",
        text: "Tu compra con Google Pay fue registrada correctamente.",
      });

      setFormData({
        nombre: "",
        email: "",
        telefono: "",
        referencia: "",
        comprobante: null,
        codigoPais: "+58",
      });

      setCapturaInmediata(false);
      setTickets(1);
      limpiarArchivo();
    } catch (error) {
      await Swal.fire({
        ...swalConfig,
        icon: "error",
        title: "Error inesperado",
        text: error?.message || "Ocurrió un error inesperado",
      });
    } finally {
      setLoadingCompra(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loadingCompra) return;

    if (paymentMethod === "App Pay" || paymentMethod === "Google Pay") {
      await Swal.fire({
        ...swalConfig,
        icon: "info",
        title: "Usa el botón de pago",
        text:
          paymentMethod === "App Pay"
            ? "Para App Pay debes usar el botón especial de la sección de pago."
            : "Para Google Pay debes usar el botón especial de la sección de pago.",
      });
      return;
    }

    try {
      setLoadingCompra(true);

      const { nombre, email, telefono, referencia, comprobante, codigoPais } = formData;
      const telefonoLimpio = telefono.replace(/[^\d]/g, "");

      if (!rifaActiva?.id) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Sin rifa disponible",
          text: "En este momento no hay una rifa disponible para comprar",
        });
        return;
      }

      if (rifaCompleta) {
        await Swal.fire({
          ...swalConfig,
          icon: "info",
          title: "Boletos agotados",
          text: "Esta rifa ya alcanzó el 100% y no acepta más compras.",
        });
        return;
      }

      if (!estaDisponibleParaCompra(rifaActiva?.estado)) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Rifa no disponible",
          text: "Esta rifa no está disponible para compra en este momento",
        });
        return;
      }

      if (precioPorTicket <= 0) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Precio inválido",
          text: "Esta rifa no tiene un precio válido configurado",
        });
        return;
      }

      if (!nombre.trim() || !email.trim() || !telefono.trim()) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Campos requeridos",
          text: "Completa todos los campos obligatorios",
        });
        return;
      }

      if (!esPagoDigital && !referencia.trim()) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Referencia requerida",
          text: "Debes ingresar el número de referencia del pago",
        });
        return;
      }

      if (!validarEmail(email)) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Email inválido",
          text: "Ingresa un correo electrónico válido",
        });
        return;
      }

      if (telefonoLimpio.length < 8) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Teléfono inválido",
          text: "Ingresa un número de teléfono válido",
        });
        return;
      }

      if (!tickets || tickets < 1 || tickets > 100) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Cantidad inválida",
          text: "Debes seleccionar entre 1 y 100 tickets",
        });
        return;
      }

      if (!esPagoDigital && !comprobante) {
        await Swal.fire({
          ...swalConfig,
          icon: "warning",
          title: "Comprobante requerido",
          text: "Debes adjuntar el comprobante de pago",
        });
        return;
      }

      let comprobanteUrl = "";

      if (comprobante) {
        const extension = comprobante.name.split(".").pop();
        const nombreArchivo = `${Date.now()}-${crypto.randomUUID()}.${extension}`;

        const { error: errorUpload } = await supabase.storage
          .from("comprobantes")
          .upload(nombreArchivo, comprobante);

        if (errorUpload) {
          await Swal.fire({
            ...swalConfig,
            icon: "error",
            title: "Error subiendo comprobante",
            text: errorUpload.message,
          });
          return;
        }

        const { data: urlData } = supabase.storage
          .from("comprobantes")
          .getPublicUrl(nombreArchivo);

        comprobanteUrl = urlData.publicUrl;
      }

      const response = await fetch("/api/comprar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim(),
          telefono: `${codigoPais || "+58"} ${telefonoLimpio}`,
          referencia: referencia.trim(),
          tickets,
          totalPagar,
          paymentMethod,
          comprobanteUrl,
          rifaId: rifaActiva.id,
          capturaInmediata,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        await Swal.fire({
          ...swalConfig,
          icon: "error",
          title: "Error",
          text: data.error || "No se pudo registrar la compra",
        });
        return;
      }

      await Swal.fire({
        ...swalConfig,
        icon: "success",
        title: "Compra registrada",
        text: "Tu compra quedó pendiente por aprobación.",
      });

      setFormData({
        nombre: "",
        email: "",
        telefono: "",
        referencia: "",
        comprobante: null,
        codigoPais: "+58",
      });

      setCapturaInmediata(false);
      setTickets(1);
      limpiarArchivo();
    } catch (error) {
      await Swal.fire({
        ...swalConfig,
        icon: "error",
        title: "Error inesperado",
        text: error?.message || "Ocurrió un error inesperado",
      });
    } finally {
      setLoadingCompra(false);
    }
  };

  if (loadingRifa && !rifaActiva) {
    return (
      <main className="page" id="inicio">
        <PublicTopbar
          active="inicio"
          onOpenVerifier={() => setShowVerifyModal(true)}
          logoHref="/principal"
          inicioHref="/#inicio"
          eventosHref="/principal#eventos-disponibles"
          resultadosHref="/principal#resultados-oficiales"
          pagosHref="/#pagos"
          contactoHref="/#contacto"
        />

        <header className="floating-header">
          <img src="/logo.png" alt="Logo" className="floating-logo" />
          <div className="floating-center">
            <h3>Cargando rifa...</h3>
            <p>Espera un momento</p>
          </div>
        </header>

        <section className="home-loading-wrap">
          <div className="home-loading-card">
            <div className="home-loading-hero" />
            <div className="home-loading-line large" />
            <div className="home-loading-line medium" />
            <div className="home-loading-line small" />
          </div>
        </section>

        <VerifyTicketsModal
          open={showVerifyModal}
          onClose={() => setShowVerifyModal(false)}
          email={verifyEmail}
          setEmail={setVerifyEmail}
          rifaId={rifaActiva?.id || null}
        />
      </main>
    );
  }

  return (
    <main className="page" id="inicio">
      <PublicTopbar
        active="inicio"
        onOpenVerifier={() => setShowVerifyModal(true)}
        logoHref="/principal"
        inicioHref="/#inicio"
        eventosHref="/principal#eventos-disponibles"
        resultadosHref="/principal#resultados-oficiales"
        pagosHref="/#pagos"
        contactoHref="/#contacto"
      />

      <header className="floating-header">
        <img src="/logo.png" alt="Logo" className="floating-logo" />
        <div className="floating-center">
          <h3>{nombreRifa || "Rifa disponible"}</h3>
          <p>{descripcionRifa || "Disponible"}</p>
        </div>
      </header>

      {!rifaActiva ? (
        <section className="home-empty-wrap">
          <div className="home-empty-box">
            <div className="home-empty-icon">🎟️</div>
            <h2>No hay rifa disponible</h2>
            <p>
              En este momento no hay una rifa publicada para comprar. Revisa los
              eventos disponibles más abajo o vuelve pronto.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="hero-showcase reveal-fade-up">
            <div className="hero-showcase-image-wrap">
              {imagenRifaPrincipal && (
                <img
                  src={imagenRifaPrincipal}
                  alt={nombreRifa || "Rifa"}
                  className={`hero-showcase-image fade-image ${showSecondImage ? "hide" : "show"}`}
                />
              )}

              {imagenRifaScroll && (
                <img
                  src={imagenRifaScroll}
                  alt={`${nombreRifa || "Rifa"} scroll`}
                  className={`hero-showcase-image fade-image ${showSecondImage ? "show" : "hide"}`}
                />
              )}

              <div className="hero-showcase-fade"></div>
            </div>

            <div className="hero-title-block">
              {nombreRifa && <h1>{nombreRifa}</h1>}
              {descripcionRifa && <p className="hero-subtitle-dark">{descripcionRifa}</p>}

              {(fechaRifa || horaRifa) && (
                <p className="hero-date-line">
                  {fechaRifa && `📅 ${fechaRifa}`} {horaRifa && `⏰ ${horaRifa}`}
                </p>
              )}

              {(premios.length > 0 || precioPorTicket > 0) && (
                <div className="hero-prize-box">
                  {premios.length > 0 && <span className="hero-prize-label">PREMIO:</span>}

                  {premios.map((premio, index) => (
                    <p key={`${premio}-${index}`}>• {premio}</p>
                  ))}

                  {precioPorTicket > 0 && (
                    <p className="hero-price-highlight">Valor: ${precioPorTicket.toFixed(2)}</p>
                  )}
                </div>
              )}
            </div>
          </section>

          {totalNumeros > 0 && (
            <section className="mini-progress-wrap reveal-fade-up reveal-delay-1">
              <div className={`mini-progress-card ${rifaCompleta ? "is-complete" : ""}`}>
                <div className="mini-progress-head">
                  <span className="mini-progress-label">
                    {rifaCompleta ? "RIFA COMPLETA" : "AVANCE DE VENTA"}
                  </span>
                  <span className="mini-progress-value">{porcentajeVendidoTexto}</span>
                </div>

                <div
                  className="mini-progress-bar"
                  role="progressbar"
                  aria-valuenow={Math.round(porcentajeVendido)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Porcentaje de boletos vendidos"
                >
                  <div
                    className={`mini-progress-fill ${rifaCompleta ? "is-complete" : ""}`}
                    style={{ width: `${porcentajeVendido}%` }}
                  />
                </div>

                {rifaCompleta && (
                  <p className="mini-progress-complete-text">
                    Todos los boletos fueron vendidos. La rifa está cerrada y pendiente de sorteo.
                  </p>
                )}
              </div>
            </section>
          )}

          <section className="form-card reveal-fade-up reveal-delay-2" id="boletos">
            <section className="card-section">
              <h2 className="big-card-title">LISTA DE BOLETOS</h2>

              {rifaCompleta && (
                <div className="home-soldout-banner">
                  <span>🎟️ BOLETOS AGOTADOS</span>
                </div>
              )}

              <div className={`ticket-controls ${rifaCompleta ? "ticket-controls-disabled" : ""}`}>
                <button
                  className="circle-btn circle-btn-muted"
                  onClick={() => setTickets((prev) => Math.max(prev - 1, 1))}
                  type="button"
                  aria-label="Disminuir cantidad de boletos"
                  disabled={rifaCompleta}
                >
                  −
                </button>

                <div className="ticket-display">
                  <div className="ticket-count">{tickets}</div>
                  <div className="ticket-label-mini">
                    BOLETO{tickets > 1 ? "S" : ""}
                  </div>
                </div>

                <div
                  className="ticket-tooltip-wrap"
                  data-tooltip={`Cada ticket cuesta $${precioPorTicket.toFixed(2)}\nRifa: ${
                    nombreRifa || "Rifa disponible"
                  }`}
                >
                  <button
                    className="circle-btn circle-btn-main"
                    onClick={() => setTickets((prev) => Math.min(prev + 1, 100))}
                    type="button"
                    aria-label="Aumentar cantidad de boletos"
                    disabled={rifaCompleta}
                  >
                    +
                  </button>
                </div>
              </div>

              <p className="main-total">Total: USD {totalPagar.toFixed(2)}</p>

              <div className="quick-ticket-buttons-red">
                {[1, 2, 5, 10, 20, 50, 100].map((num) => (
                  <button
                    key={num}
                    className={`quick-ticket-btn-red ${tickets === num ? "active" : ""}`}
                    onClick={() => setTickets(num)}
                    type="button"
                    disabled={rifaCompleta}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </section>

            <form onSubmit={handleSubmit} className="purchase-form">
              <section className="card-section">
                <h3 className="section-heading">📋 DATOS PERSONALES</h3>

                <div className="input-stack">
                  <label className="input-label">Nombres y Apellidos *</label>
                  <input
                    type="text"
                    name="nombre"
                    placeholder="Ingresa tu nombre completo"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    required
                    disabled={rifaCompleta}
                  />

                  <label className="input-label">Email *</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="Ingresa tu correo"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    disabled={rifaCompleta}
                  />

                  <label className="input-label">Teléfono *</label>
                  <div className="phone-row">
                    <select
                      name="codigoPais"
                      className="phone-prefix-select"
                      value={formData.codigoPais}
                      onChange={handleInputChange}
                      disabled={rifaCompleta}
                    >
                      <option value="+58">🇻🇪 VE +58</option>
                      <option value="+57">🇨🇴 CO +57</option>
                      <option value="+1">🇺🇸 US +1</option>
                      <option value="+52">🇲🇽 MX +52</option>
                      <option value="+34">🇪🇸 ES +34</option>
                      <option value="+51">🇵🇪 PE +51</option>
                      <option value="+54">🇦🇷 AR +54</option>
                      <option value="+56">🇨🇱 CL +56</option>
                      <option value="+593">🇪🇨 EC +593</option>
                      <option value="+591">🇧🇴 BO +591</option>
                      <option value="+595">🇵🇾 PY +595</option>
                      <option value="+598">🇺🇾 UY +598</option>
                      <option value="+507">🇵🇦 PA +507</option>
                      <option value="+506">🇨🇷 CR +506</option>
                      <option value="+503">🇸🇻 SV +503</option>
                      <option value="+502">🇬🇹 GT +502</option>
                      <option value="+505">🇳🇮 NI +505</option>
                      <option value="+504">🇭🇳 HN +504</option>
                      <option value="+53">🇨🇺 CU +53</option>
                      <option value="+1-809">🇩🇴 DO +1</option>
                    </select>

                    <input
                      type="tel"
                      name="telefono"
                      placeholder="Número de teléfono"
                      value={formData.telefono}
                      onChange={handleInputChange}
                      required
                      disabled={rifaCompleta}
                    />
                  </div>

                  {!esPagoDigital && (
                    <>
                      <label className="input-label">Número de referencia *</label>
                      <input
                        type="text"
                        name="referencia"
                        placeholder="Ejemplo: 1234567890"
                        value={formData.referencia}
                        onChange={handleInputChange}
                        required
                        disabled={rifaCompleta}
                      />
                    </>
                  )}
                </div>
              </section>

              <section className="card-section" id="pagos">
                <h3 className="section-heading">🏦 MODOS DE PAGO</h3>
                <p className="section-soft-text">
                  {rifaCompleta
                    ? "La venta está cerrada porque la rifa alcanzó el 100%."
                    : "Elige una opción."}
                </p>

                <div className="payment-options-row">
                  {paymentMethods.map((method) => (
                    <button
                      key={method}
                      className={`payment-pill ${paymentMethodsConfig[method].bgClass} ${
                        paymentMethod === method ? "active" : ""
                      }`}
                      onClick={() => setPaymentMethod(method)}
                      type="button"
                      disabled={rifaCompleta}
                    >
                      <div className="payment-pill-logo-wrap">
                        <img
                          src={paymentMethodsConfig[method].logo}
                          alt={method}
                          className="payment-pill-logo-img"
                        />
                      </div>

                      <span className="payment-pill-text">{method}</span>

                      {paymentMethod === method && (
                        <span className="payment-selected-check">✔</span>
                      )}
                    </button>
                  ))}
                </div>

                {paymentMethod === "App Pay" ? (
                  <div className="apppay-detail-box premium-card-hover">
                    <span className="apppay-detail-label">{metodoSeleccionado.subtitulo}</span>

                    <div className="apppay-brand"> Pay</div>

                    <div className="apppay-total">
                      Total: ${Number(totalPagar || 0).toFixed(2)} USD
                    </div>

                    <div className="apppay-debug-amount">
                      Cobro confirmado: ${(Math.round(Number(totalPagar || 0) * 100) / 100).toFixed(2)} USD
                    </div>

                    {!loadingRifa && rifaActiva?.id && (
                      <div key={`apppay-wrap-${rifaActiva.id}-${tickets}-${totalPagar}`}>
                        <AppPayButton
                          key={`apppay-btn-${rifaActiva.id}-${tickets}-${totalPagar}`}
                          totalPagar={Number(totalPagar || 0)}
                          nombreRifa={nombreRifa}
                          registrarCompra={registrarCompraAppPay}
                          swalConfig={swalConfig}
                          disabled={
                            loadingCompra ||
                            !rifaActiva?.id ||
                            tickets < 1 ||
                            precioPorTicket <= 0 ||
                            !estaDisponibleParaCompra(rifaActiva?.estado) ||
                            rifaCompleta
                          }
                        />
                      </div>
                    )}

                    <p className="apppay-note">{metodoSeleccionado.descripcion}</p>

                    {metodoSeleccionado.note && (
                      <p className="apppay-disclaimer">{metodoSeleccionado.note}</p>
                    )}
                  </div>
                ) : paymentMethod === "Google Pay" ? (
                  <div className="apppay-detail-box premium-card-hover">
                    <span className="apppay-detail-label">{metodoSeleccionado.subtitulo}</span>

                    <div className="apppay-brand">G Pay</div>

                    <div className="apppay-total">
                      Total: ${Number(totalPagar || 0).toFixed(2)} USD
                    </div>

                    <div className="apppay-debug-amount">
                      Cobro confirmado: ${(Math.round(Number(totalPagar || 0) * 100) / 100).toFixed(2)} USD
                    </div>

                    <button
                      type="button"
                      className="confirm-main-btn"
                      onClick={() =>
                        registrarCompraGooglePay({
                          referenciaPago: "GOOGLEPAY",
                        })
                      }
                      disabled={
                        loadingCompra ||
                        !rifaActiva?.id ||
                        tickets < 1 ||
                        precioPorTicket <= 0 ||
                        !estaDisponibleParaCompra(rifaActiva?.estado) ||
                        rifaCompleta
                      }
                    >
                      CONTINUAR CON GOOGLE PAY
                    </button>

                    <p className="apppay-note">{metodoSeleccionado.descripcion}</p>

                    {metodoSeleccionado.note && (
                      <p className="apppay-disclaimer">{metodoSeleccionado.note}</p>
                    )}
                  </div>
                ) : (
                  <div className="selected-payment-box premium-card-hover">
                    <h4>{metodoSeleccionado.titulo}</h4>
                    <span className="payment-small-label">{metodoSeleccionado.subtitulo}</span>

                    <div className="payment-account-row">
                      <div className="payment-account">{metodoSeleccionado.cuenta}</div>
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => copiarTexto(metodoSeleccionado.cuenta)}
                        disabled={rifaCompleta}
                      >
                        Copiar
                      </button>
                    </div>

                    <div className="payment-owner">TITULAR: {metodoSeleccionado.nombre}</div>

                    {Array.isArray(metodoSeleccionado.extra) &&
                      metodoSeleccionado.extra.map((item) => (
                        <div key={`${item.label}-${item.value}`} className="payment-account-row">
                          <div className="payment-account">
                            {item.label}: {item.value}
                          </div>
                          <button
                            type="button"
                            className="copy-btn"
                            onClick={() => copiarTexto(item.value)}
                            disabled={rifaCompleta}
                          >
                            Copiar
                          </button>
                        </div>
                      ))}

                    <div className="payment-total-banner">
                      Total: ${totalPagar.toFixed(2)} USD ({tickets} boleto
                      {tickets > 1 ? "s" : ""})
                    </div>

                    <p className="payment-description">{metodoSeleccionado.descripcion}</p>
                  </div>
                )}
              </section>

              {!esPagoDigital && (
                <section className="card-section">
                  <h3 className="section-heading">📄 COMPROBANTE DE PAGO</h3>
                  <p className="section-soft-text">Foto o Captura de Pantalla</p>

                  <label className="checkbox-line">
                    <input
                      type="checkbox"
                      checked={capturaInmediata}
                      onChange={(e) => setCapturaInmediata(e.target.checked)}
                      disabled={rifaCompleta}
                    />
                    <span>ENVIAR CAPTURA INMEDIATAMENTE</span>
                  </label>

                  <label className="upload-dashed-box" htmlFor="comprobante">
                    <div className="upload-circle-icon">⬆</div>
                    <div className="upload-box-text">
                      {formData.comprobante
                        ? `Archivo: ${formData.comprobante.name}`
                        : "Foto/Captura de Pantalla"}
                    </div>

                    <input
                      id="comprobante"
                      ref={fileInputRef}
                      type="file"
                      name="comprobante"
                      onChange={handleInputChange}
                      hidden
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      disabled={rifaCompleta}
                    />
                  </label>

                  {formData.comprobante && (
                    <div className="file-actions-row">
                      <button type="button" className="remove-file-btn" onClick={limpiarArchivo}>
                        Quitar archivo
                      </button>
                    </div>
                  )}

                  {previewUrl && (
                    <div className="preview-box">
                      <img
                        src={previewUrl}
                        alt="Vista previa del comprobante"
                        className="preview-img"
                      />
                    </div>
                  )}

                  {formData.comprobante?.type === "application/pdf" && (
                    <div className="pdf-preview-note">PDF seleccionado correctamente.</div>
                  )}

                  <p className="upload-method-summary">
                    {paymentMethod}: ${totalPagar.toFixed(2)} USD ({tickets} boleto
                    {tickets > 1 ? "s" : ""})
                  </p>

                  <p className="privacy-note">
                    Al confirmar autorizo el uso de <span>Mis Datos Personales</span>
                  </p>
                </section>
              )}

              <section className="card-section no-border">
                {paymentMethod === "App Pay" ? (
                  <div className="apppay-submit-helper">
                    <p className="apppay-submit-helper-text">
                      Usa el botón negro de  Pay para completar tu pago.
                    </p>
                  </div>
                ) : paymentMethod === "Google Pay" ? (
                  <div className="apppay-submit-helper">
                    <p className="apppay-submit-helper-text">
                      Usa el botón de Google Pay para completar tu registro.
                    </p>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className={`confirm-main-btn ${rifaCompleta ? "confirm-main-btn-disabled" : ""}`}
                    disabled={
                      loadingCompra ||
                      !rifaActiva?.id ||
                      !estaDisponibleParaCompra(rifaActiva?.estado) ||
                      precioPorTicket <= 0 ||
                      rifaCompleta
                    }
                  >
                    {loadingCompra
                      ? "PROCESANDO..."
                      : rifaCompleta
                      ? "BOLETOS AGOTADOS"
                      : !rifaActiva?.id
                      ? "NO HAY RIFA DISPONIBLE"
                      : !estaDisponibleParaCompra(rifaActiva?.estado)
                      ? "RIFA NO DISPONIBLE"
                      : precioPorTicket <= 0
                      ? "PRECIO NO DISPONIBLE"
                      : "CONFIRMAR"}
                  </button>
                )}

                {loadingRifa && <p className="loading-text">Actualizando datos...</p>}
              </section>
            </form>
          </section>
        </>
      )}

      <section className="verify-section reveal-fade-up reveal-delay-3">
        <h2>¿Quieres verificar tus tickets?</h2>
        <p>Ingresa el correo que usaste en la compra.</p>

        <button
          onClick={() => setShowVerifyModal(true)}
          className="verify-btn"
          type="button"
        >
          Verificar mis tickets
        </button>
      </section>

      <HomeEventosPreview rifas={rifasPublicadasOrdenadas} />

      <footer className="footer reveal-fade-up reveal-delay-4" id="contacto">
        <h2>Conéctate con nosotros</h2>
        <div className="footer-links">
          <a
            href="https://wa.me/17738277463?text=Hola%20quiero%20informaci%C3%B3n%20sobre%20la%20rifa"
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp Soporte
          </a>
          <a
            href="https://www.instagram.com/samir__rivas/"
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>
        </div>
        <p>© 2026 - Todos los derechos reservados.</p>
      </footer>

      <VerifyTicketsModal
        open={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        email={verifyEmail}
        setEmail={setVerifyEmail}
        rifaId={rifaActiva?.id || null}
      />

      {showAppPayModal && (
        <div className="apppay-modal-overlay" onClick={() => setShowAppPayModal(false)}>
          <div className="apppay-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="apppay-modal-close"
              onClick={() => setShowAppPayModal(false)}
              aria-label="Cerrar modal App Pay"
            >
              ✕
            </button>

            <div className="apppay-modal-brand"> Pay</div>

            <div className="apppay-modal-card">
              <div className="apppay-modal-row">
                <span>Método</span>
                <strong>App Pay</strong>
              </div>

              <div className="apppay-modal-row">
                <span>Rifa</span>
                <strong>{nombreRifa || "Rifa disponible"}</strong>
              </div>

              <div className="apppay-modal-row">
                <span>Boletos</span>
                <strong>
                  {tickets} boleto{tickets > 1 ? "s" : ""}
                </strong>
              </div>

              <div className="apppay-modal-row total">
                <span>Total</span>
                <strong>${totalPagar.toFixed(2)} USD</strong>
              </div>
            </div>

            <button
              type="button"
              className="apppay-modal-pay-btn"
              onClick={() => {
                setShowAppPayModal(false);
                Swal.fire({
                  ...swalConfig,
                  icon: "info",
                  title: "App Pay",
                  html: `
                    <div style="line-height:1.7;">
                      <p>El flujo visual de App Pay está listo.</p>
                      <p>Para procesar pagos reales con Apple Pay necesitas integración con Stripe u otro proveedor compatible.</p>
                      <p>Puedes continuar usando el formulario para registrar tu compra y comprobante.</p>
                    </div>
                  `,
                });
              }}
            >
               Pay
            </button>

            <p className="apppay-modal-help">
              Compatible con dispositivos y navegadores compatibles.
            </p>
          </div>
        </div>
      )}

      <PurchaseGuideFloating onOpenVerifier={() => setShowVerifyModal(true)} />

      <a
        href="https://wa.me/17738277463?text=Hola%20quiero%20informaci%C3%B3n%20sobre%20la%20rifa"
        target="_blank"
        rel="noreferrer"
        className="whatsapp-float"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="whatsapp-icon">
          <path
            fill="white"
            d="M19.11 17.21c-.29-.15-1.71-.84-1.98-.93-.27-.1-.46-.15-.66.15-.19.29-.76.93-.93 1.12-.17.19-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.43-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.19-.29.29-.49.1-.19.05-.37-.02-.51-.07-.15-.66-1.59-.9-2.18-.24-.57-.48-.49-.66-.5h-.56c-.19 0-.49.07-.74.34-.24.27-.95.93-.95 2.28s.98 2.66 1.12 2.85c.15.19 1.93 2.95 4.68 4.14.65.28 1.16.45 1.56.58.66.21 1.26.18 1.73.11.53-.08 1.71-.7 1.95-1.38.24-.68.24-1.26.17-1.38-.07-.11-.27-.18-.56-.33Z"
          />
          <path
            fill="white"
            d="M16.01 3C8.83 3 3 8.73 3 15.8c0 2.49.72 4.81 1.96 6.78L3.2 29l6.62-1.72a13.1 13.1 0 0 0 6.19 1.57h.01c7.18 0 13-5.73 13-12.8C29.02 8.73 23.19 3 16.01 3Zm0 23.54h-.01a10.8 10.8 0 0 1-5.5-1.5l-.39-.23-3.93 1.02 1.05-3.8-.25-.39a10.45 10.45 0 0 1-1.63-5.6C5.35 10.19 10.12 5.5 16 5.5c5.88 0 10.66 4.69 10.66 10.46 0 5.78-4.78 10.58-10.65 10.58Z"
          />
        </svg>
      </a>
    </main>
  );
}