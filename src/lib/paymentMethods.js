export const paymentMethodsConfig = {
  Binance: {
    key: "Binance",
    titulo: "BINANCE",
    descripcion:
      "Haz la transferencia y luego llena el formulario con los datos exactos del pago.",
    nombre: "JEANCORLUIS440",
    cuenta: "234578344",
    subtitulo: "ID",
    logo: "/payment/binance.png",
    bgClass: "binance-bg",
    type: "standard",
  },

  Zelle: {
    key: "Zelle",
    titulo: "ZELLE",
    descripcion:
      "Coloca el número de confirmación completo. No coloques 'rifa' en el concepto del pago.",
    nombre: "Samir Rivas Mena",
    cuenta: "samirrivasmena@gmail.com",
    subtitulo: "EMAIL",
    logo: "/payment/zelle.png",
    bgClass: "zelle-bg",
    type: "standard",
  },

  "Banco de Venezuela": {
    key: "Banco de Venezuela",
    titulo: "PAGOMÓVIL BDV",
    descripcion:
      "Realiza tu pago y coloca la referencia completa para validar la compra.",
    nombre: "JEANCORLUIS MALAVE",
    cuenta: "04242502729",
    subtitulo: "TELÉFONO",
    logo: "/payment/bdv.png",
    bgClass: "bdv-bg",
    extra: [{ label: "CI", value: "25011847" }],
    type: "standard",
  },

  "App Pay": {
    key: "App Pay",
    titulo: "APP PAY",
    descripcion:
      "Usa App Pay en dispositivos compatibles para realizar tu pago de forma rápida y segura.",
    nombre: "Samir Rivas",
    cuenta: "App Pay disponible",
    subtitulo: "PAGO RÁPIDO",
    logo: "/payment/apppay.png",
    bgClass: "apppay-bg",
    type: "wallet",
    note: "Compatible con dispositivos Apple y navegadores compatibles.",
  },

  PayPal: {
    key: "PayPal",
    titulo: "PAYPAL",
    descripcion:
      "Envía el pago a la cuenta indicada en PayPal y luego completa el formulario con la referencia exacta.",
    nombre: "Samir Rivas",
    cuenta: "paypal.me/SamirRivas",
    subtitulo: "USUARIO",
    logo: "/payment/paypal.png",
    bgClass: "paypal-bg",
    type: "standard",
  },

  "Cash App": {
    key: "Cash App",
    titulo: "CASH APP",
    descripcion:
      "Envía el pago a través de Cash App y luego completa el formulario con la referencia o comprobante.",
    nombre: "Samir Rivas",
    cuenta: "$SamirRivas",
    subtitulo: "CASH TAG",
    logo: "/payment/cashapp.png",
    bgClass: "cashapp-bg",
    type: "standard",
  },
};

export const paymentMethodsList = [
  "Binance",
  "Zelle",
  "Banco de Venezuela",
  "App Pay",
  "PayPal",
  "Cash App",
];