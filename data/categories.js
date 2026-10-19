// The spending categories shown on the results page.
// To change an image, drop a new PNG (transparent background works best) into assets/cutouts/
// and point "img" at it. "anim" is the moving version (GIF or animated WebP) shown on the results page. "color" is the tile background.
window.CATEGORIES = [
  // The 12 main categories
  { key: "roads",      label: "Roads & bridges",          img: "assets/cutouts/roads.png", anim: "assets/gifs/roads.webp",      color: "#ffd23f", about: "Paving, potholes, highways, bridges, and traffic signals." },
  { key: "transit",    label: "Public transit",           img: "assets/cutouts/transit.png", anim: "assets/gifs/transit.webp",    color: "#3fb8ff", about: "Buses, trains, light rail, and the systems that run them." },
  { key: "parks",      label: "Parks & recreation",       img: "assets/cutouts/parks.png", anim: "assets/gifs/parks.webp",      color: "#4fd65a", about: "Parks, playgrounds, community centers, and national parks." },
  { key: "education",  label: "Education",                img: "assets/cutouts/education.png", anim: "assets/gifs/education.webp",  color: "#ff8a3d", about: "Public schools, community colleges, universities, and student aid." },
  { key: "housing",    label: "Housing & homelessness",   img: "assets/cutouts/housing.png", anim: "assets/gifs/housing.webp",    color: "#ff6fb5", about: "Rental help, affordable housing, shelters, and homelessness programs." },
  { key: "emergency",  label: "Emergency services",       img: "assets/cutouts/emergency.png", anim: "assets/gifs/emergency.webp",  color: "#ff3b30", about: "Firefighters, paramedics, and disaster response." },
  { key: "police",     label: "Police & public safety",   img: "assets/cutouts/police.png", anim: "assets/gifs/police.webp",     color: "#2f5bff", about: "Police, courts, prisons, and federal law enforcement." },
  { key: "culture",    label: "Libraries & culture",      img: "assets/cutouts/culture.png", anim: "assets/gifs/culture.webp",    color: "#b78cff", about: "Libraries, museums, and arts programs." },
  { key: "health",     label: "Public health",            img: "assets/cutouts/health.png", anim: "assets/gifs/health.webp",     color: "#7ef0d4", about: "Medicare, Medicaid (Medi-Cal), hospitals, and disease prevention." },
  { key: "water",      label: "Water & environment",      img: "assets/cutouts/water.png", anim: "assets/gifs/water.webp",      color: "#59d8ff", about: "Clean water, levees, wildfire prevention, and environmental protection." },
  { key: "government", label: "Government operations",    img: "assets/cutouts/government.png", anim: "assets/gifs/government.webp", color: "#c9c9c9", about: "Running the government: lawmakers, tax collection, staff, IT, and buildings." },
  { key: "defense",    label: "Defense & veterans",       img: "assets/cutouts/defense.png", anim: "assets/gifs/defense.webp",    color: "#a8b85a", about: "The military and care and benefits for veterans." },

  // Big buckets that don't fit the 12, but are too large to leave out
  { key: "retirement", label: "Social Security",          img: "assets/cutouts/retirement.png", anim: "assets/gifs/retirement.webp", color: "#ffe9a8", extra: true, about: "Monthly checks to retirees, people with disabilities, and survivors." },
  { key: "debt",       label: "Paying off debt",          img: "assets/cutouts/interest.png", anim: "assets/gifs/debt.webp",   color: "#d6ff3f", extra: true, about: "Interest and payments on money the government borrowed." },
  { key: "safetynet",  label: "Safety net",               img: "assets/cutouts/safetynet.png", anim: "assets/gifs/safetynet.webp",  color: "#ffb38a", extra: true, about: "Food aid, cash assistance, disability services, tax credits for working families, and unemployment." },
  { key: "reserves",   label: "Savings & reserves",       img: "assets/cutouts/reserves.png", anim: "assets/gifs/reserves.webp",   color: "#f2f2a0", extra: true, about: "Money set aside for emergencies and shared citywide costs." },
  { key: "other",      label: "Everything else",          img: "assets/cutouts/other.png", anim: "assets/gifs/other.webp",      color: "#e0d0b8", extra: true, about: "Smaller items that don't fit a category: science, agriculture, foreign aid, job programs, and more." }
];
