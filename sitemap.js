export default function sitemap() {
  return [
    {
      url: "https://rifaslsd.vercel.app/",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://rifaslsd.vercel.app/principal",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];
}