export const safeEncode = (value) => encodeURIComponent(String(value ?? ""));

export const buildShareText = ({ title = "", text = "" } = {}) => {
  const t = String(title || "").trim();
  const x = String(text || "").trim();
  if (t && x) return `${t} - ${x}`;
  return t || x || "Mira esto:";
};

export const openPopup = (url) => {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
};

export const copyToClipboard = async (value) => {
  const text = String(value ?? "");
  if (!text) return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  try {
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "true");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};