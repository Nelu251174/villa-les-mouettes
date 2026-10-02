export const SITE = {
  name: "Villa Les Mouettes",
  // Numar/email: furnizate de OWNER (README handoff). Adresa exacta si coordonatele NU sunt confirmate.
  phone: "+33 688 462 481",
  phoneHref: "tel:+33688462481",
  whatsappNumber: "33688462481",
  whatsappHref: "https://wa.me/33688462481",
  email: "support@villalesmouettes.com",
  addressLine: "Villa Les Mouettes, Roquebrune-Cap-Martin, 06190, France",
  addressConfirmed: false,
  geo: { lat: 43.7621, lng: 7.4573, confirmed: false },
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
};

export const PHOTOS = {
  facade: "/photos/facade.jpg",
  aerial: "/photos/aerial.jpg",
  seaview: "/photos/seaview.jpg",
  salon: "/photos/salon.jpg",
  hammam: "/photos/hammam.jpg",
  terrace: "/photos/terrace.jpg",
} as const;

// Alt-urile bogate in cuvinte cheie sunt din design (cerinta SEO).
export const ALT = {
  facade: "Luxury villa near Monaco — the white facade of Villa Les Mouettes, Roquebrune-Cap-Martin",
  aerial: "Villa Les Mouettes and its landscaped gardens seen from above",
  seaview: "Panoramic Mediterranean sea view from the master terrace of the luxury villa near Monaco",
  salon: "The main salon — classic French interiors with crystal chandeliers",
  hammam: "Private hammam — spa of the luxury villa near Monaco",
  terrace: "Covered sea-view terrace with columns — Villa Les Mouettes",
} as const;

export const GALLERY: { src: string; alt: string; cap: string; capD: string }[] = [
  { src: "master-bedroom", alt: "Master bedroom with sea view terrace — luxury villa Monaco", cap: "cap1", capD: "capD1" },
  { src: "pool", alt: "Private pool of the villa near Monaco", cap: "cap2", capD: "capD2" },
  { src: "guest-bedroom", alt: "Guest bedroom in mint tones", cap: "cap7", capD: "capD7" },
  { src: "bathroom", alt: "Marble bathroom", cap: "cap8", capD: "capD8" },
  { src: "kitchen", alt: "The kitchen opening onto the garden terrace", cap: "cap9", capD: "capD9" },
  { src: "sitting-room", alt: "Sitting room opening onto the garden", cap: "cap10", capD: "capD10" },
  { src: "library", alt: "The library salon", cap: "cap11", capD: "capD11" },
  { src: "entrance-hall", alt: "Panelled entrance hall and staircase", cap: "cap12", capD: "capD12" },
  { src: "blue-bedroom", alt: "Guest bedroom in blue tones", cap: "cap13", capD: "capD13" },
].map((g) => ({ ...g, src: `/photos/${g.src}.jpg` }));

// Link Google Maps: cu coordonate confirmate deschide direct pinul exact; altfel cade pe cautare dupa nume (NEconfirmat).
export const MAPS_HREF = SITE.geo.confirmed
  ? `https://www.google.com/maps/search/?api=1&query=${SITE.geo.lat},${SITE.geo.lng}`
  : "https://www.google.com/maps/search/?api=1&query=Villa+Les+Mouettes+Roquebrune-Cap-Martin+France";
