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
      "Usa App Pay en dispositivos compatibles para realizar tu pago. Luego completa el formulario con tu referencia o comprobante para validar la compra.",
    nombre: "Samir Rivas",
    cuenta: "App Pay disponible",
    subtitulo: "PAGO RÁPIDO",
    logo: "/payment/apppay.png",
    bgClass: "apppay-bg",
    type: "wallet",
    note: "Compatible con dispositivos y navegadores compatibles.",
  },
};

export const paymentMethodsList = Object.keys(paymentMethodsConfig);