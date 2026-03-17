"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [tickets, setTickets] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("Zelle");
  const [showSecondImage, setShowSecondImage] = useState(false);

  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    telefono: "",
    referencia: "",
    verificarEmail: "",
    comprobante: null,
  });

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 180) {
        setShowSecondImage(true);
      } else {
        setShowSecondImage(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const paymentInfo = {
    Zelle: {
      titulo: "Zelle 🇺🇸",
      descripcion:
        "Colocar número de confirmación completo. En el concepto del pago NO colocar 'rifa'. Al registrarte usa nombre y apellido de la persona que envía el pago para validar la compra.",
      nombre: "Samir Rivas Mena",
      cuenta: "samirrivasmena@gmail.com",
      precio: "$3 DOLARES POR TICKET",
    },
    Binance: {
      titulo: "Binance",
      descripcion:
        "Haz la transferencia y luego llena el formulario con los datos exactos del pago.",
      nombre: "Usuario Binance",
      cuenta: "ID o correo de Binance",
      precio: "$3 DOLARES POR TICKET",
    },
    "Banco de Venezuela": {
      titulo: "Banco de Venezuela",
      descripcion:
        "Realiza tu pago y coloca la referencia completa para validar tu compra.",
      nombre: "Titular del banco",
      cuenta: "0102-xxxx-xxxx-xx",
      precio: "$3 DOLARES POR TICKET",
    },
    Bancolombia: {
      titulo: "Bancolombia",
      descripcion:
        "Envía el pago a la cuenta indicada y sube el comprobante correctamente.",
      nombre: "Titular Bancolombia",
      cuenta: "300xxxxxxx",
      precio: "$3 DOLARES POR TICKET",
    },
  };

  const precioPorTicket = 3;
  const totalPagar = tickets * precioPorTicket;
  
  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "comprobante") {
      setFormData({ ...formData, comprobante: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Formulario enviado.");
  };

  const handleVerify = () => {
    alert(`Verificando tickets del correo: ${formData.verificarEmail}`);
  };

  return (
    <main className="page">
      <header className="top-header">
        <img src="/logo.png" alt="Logo" className="logo" />
      </header>

      <section className="hero-switch">
        <div className="image-wrapper">
          <img
            src="/FOTO-DT-AZUL.jpeg"
            alt="Primera imagen"
            className={`hero-image fade-image ${showSecondImage ? "hide" : "show"}`}
          />

          <img
            src="/FOTO-DT-AZUL2.jpeg"
            alt="Segunda imagen"
            className={`hero-image fade-image second-layer ${showSecondImage ? "show" : "hide"}`}
          />

          <div className="fade-overlay"></div>
        </div>

        <div className="title-box">
          <h1>RIFAS-LSD</h1>
          <p>DT del año AZUL</p>
        </div>
      </section>

      <section className="ticket-section-red">
        <h2 className="ticket-title-red">COMPRAR TUS TICKETS</h2>
        <p className="ticket-subtitle-red">Mínimo 1 y Máximo 100 Tickets por Compra</p>

        <div className="ticket-counter">
          <button
            className="counter-btn-red minus-red"
            onClick={() => setTickets((prev) => Math.max(prev - 1, 1))}
          >
            −
          </button>

          <input
            type="number"
            className="ticket-input-red"
            value={tickets}
            onChange={(e) =>
              setTickets(Math.min(100, Math.max(1, Number(e.target.value) || 1)))
            }
            min="1"
            max="100"
          />

          <button
            className="counter-btn-red plus-red"
            onClick={() => setTickets((prev) => Math.min(prev + 1, 100))}
          >
            +
          </button>
        </div>

        <p className="ticket-label-red">Selecciona una cantidad de Tickets</p>

<div className="quick-ticket-buttons-red">
  {[2, 5, 10, 20, 50, 100].map((num) => (
    <button
      key={num}
      className="quick-ticket-btn-red"
      onClick={() => setTickets(num)}
    >
      {num}
    </button>
  ))}
</div>


<div className="total-box">
  <p><strong>Precio por ticket:</strong> ${precioPorTicket}</p>
  <p><strong>Total a pagar:</strong> ${totalPagar}</p>
</div>
      </section>

      <section className="section">
        <h2>¿A dónde quieres transferir?</h2>
        <p>Selecciona una cuenta:</p>

        <div className="payment-grid">
          {Object.keys(paymentInfo).map((method) => (
            <button
              key={method}
              className={`payment-card ${paymentMethod === method ? "active" : ""}`}
              onClick={() => setPaymentMethod(method)}
            >
              {method}
            </button>
          ))}
        </div>

        <div className="payment-info">
          <h3>{paymentInfo[paymentMethod].titulo}</h3>
          <p>{paymentInfo[paymentMethod].descripcion}</p>
          <p><strong>Nombre:</strong> {paymentInfo[paymentMethod].nombre}</p>
          <p><strong>N° de cuenta:</strong> {paymentInfo[paymentMethod].cuenta}</p>
          <p><strong>Precio del ticket:</strong> {paymentInfo[paymentMethod].precio}</p>
        </div>
      </section>

      <section className="section form-section">
        <h2>¿Ya transferiste?</h2>
        <p>Llena este formulario:</p>

        <form onSubmit={handleSubmit} className="form">
          <input
            type="text"
            name="nombre"
            placeholder="Nombre del comprador*"
            value={formData.nombre}
            onChange={handleInputChange}
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Email*"
            value={formData.email}
            onChange={handleInputChange}
            required
          />

          <input
            type="tel"
            name="telefono"
            placeholder="Número de teléfono*"
            value={formData.telefono}
            onChange={handleInputChange}
            required
          />

          <input
            type="text"
            name="referencia"
            placeholder="Número de referencia*"
            value={formData.referencia}
            onChange={handleInputChange}
            required
          />

<input
  type="number"
  value={tickets}
  readOnly
  placeholder="Número de tickets"
/>

<input
  type="text"
  value={`$${totalPagar}`}
  readOnly
  placeholder="Total a pagar"
/>

          <label className="upload-label">
            Click aquí para subir comprobante de pago
            <input
              type="file"
              name="comprobante"
              onChange={handleInputChange}
              hidden
            />
          </label>

          <button type="submit" className="main-btn">
            Comprar tickets
          </button>
        </form>
      </section>

      <section className="section verify-section">
        <h2>¿Quieres verificar tus tickets?</h2>
        <p>Ingresa el correo aquí:</p>

        <input
          type="email"
          name="verificarEmail"
          placeholder="Ingrese email para la verificación"
          value={formData.verificarEmail}
          onChange={handleInputChange}
        />

        <button onClick={handleVerify} className="verify-btn">
          Verificar mis tickets
        </button>
      </section>

      <footer className="footer">
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

      <a
        href="https://wa.me/17738277463?text=Hola%20quiero%20informaci%C3%B3n%20sobre%20la%20rifa"
        target="_blank"
        rel="noreferrer"
        className="whatsapp-float"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
          className="whatsapp-icon"
        >
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