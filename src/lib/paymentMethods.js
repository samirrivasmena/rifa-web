export const paymentMethodsConfig = {
  Binance: {
    key: "Binance",
    logo: "/payment/binance.png",
    bgClass: "binance-bg",
    type: "standard",
  },

  Zelle: {
    key: "Zelle",
    logo: "/payment/zelle.png",
    bgClass: "zelle-bg",
    type: "standard",
  },

  "App Pay": {
    key: "App Pay",
    logo: "/payment/apppay.png",
    bgClass: "apppay-bg",
    type: "wallet",
  },

  PayPal: {
    key: "PayPal",
    logo: "/payment/paypal.png",
    bgClass: "paypal-bg",
    type: "standard",
  },

  "Cash App": {
    key: "Cash App",
    logo: "/payment/cashapp.png",
    bgClass: "cashapp-bg",
    type: "standard",
  },
};

export const paymentMethodsList = [
  "Binance",
  "Zelle",
  "App Pay",
  "PayPal",
  "Cash App",
];