export function getCacheBustedUrl(url = "", version = "") {
  if (!url) return "";
  return version
    ? `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`
    : url;
}