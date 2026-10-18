// The spending categories shown on the results page.
// To change an image, drop a new PNG (transparent background works best) into assets/cutouts/
// and point "img" at it. "color" is the tile background.
window.CATEGORIES = [
  // The 12 main categories
  { key: "roads",      label: "Roads & bridges",          img: "assets/cutouts/roads.png",      color: "#ffd23f", about: "Paving, potholes, highways, bridges, and traffic signals." },
  { key: "transit",    label: "Public transit",           img: "assets/cutouts/transit.png",    color: "#3fb8ff", about: "Buses, trains, light rail, and the systems that run them." },
  { key: "parks",      label: "Parks & recreation",       img: "assets/cutouts/parks.png",      color: "#4fd65a", about: "Parks, playgrounds, community centers, and national parks." },
  { key: "education",  label: "Education",                img: "assets/cutouts/education.png",  color: "#ff8a3d", about: "Public schools, community colleges, universities, and student aid." },
  { key: "housing",    label: "Housing & homelessness",   img: "assets/cutouts/housing.png",    color: "#ff6fb5", about: "Rental help, affordable housing, shelters, and homelessness programs." },
  { key: "emergency",  label: "Emergency services",       img: "assets/cutouts/emergency.png",  color: "#ff3b30", about: "Firefighters, paramedics, and disaster response." },
  { key: "police",     label: "Police & public safety",   img: "assets/cutouts/police.png",     color: "#2f5bff", about: "Police, courts, prisons, and federal law enforcement." },
  { key: "culture",    label: "Libraries & culture",      img: "assets/cutouts/culture.png",    color: "#b78cff", about: "Libraries, museums, and arts programs." },
  { key: "health",     label: "Public health",            img: "assets/cutouts/health.png",     color: "#7ef0d4", about: "Medicare, Medicaid (Medi-Cal), hospitals, and disease prevention." },
  { key: "water",      label: "Water & environment",      img: "assets/cutouts/water.png",      color: "#59d8ff", about: "Clean water, levees, wildfire prevention, and environmental protection." },
  { key: "government", label: "Government operations",    img: "assets/cutouts/government.png", color: "#c9c9c9", about: "Running the government: lawmakers, tax collection, staff, IT, and buildings." },
  { key: "defense",    label: "Defense & veterans",       img: "assets/cutouts/defense.png",    color: "#a8b85a", about: "The military and care and benefits for veterans." },

  // Big buckets that don't fit the 12, but are too large to leave out
  { key: "retirement", label: "Social Security",          img: "assets/cutouts/retirement.png", color: "#ffe9a8", extra: true, about: "Monthly checks to retirees, people with disabilities, and survivors." },
  { key: "debt",       label: "Paying off debt",          img: "assets/cutouts/interest.png",   color: "#d6ff3f", extra: true, about: "Interest and payments on money the government borrowed." },
  { key: "safetynet",  label: "Safety net",               img: "assets/cutouts/safetynet.png",  color: "#ffb38a", extra: true, about: "Food aid, cash assistance, disability services, tax credits for working families, and unemployment." },
  { key: "reserves",   label: "Savings & reserves",       img: "assets/cutouts/reserves.png",   color: "#f2f2a0", extra: true, about: "Money set aside for emergencies and shared citywide costs." },
  { key: "other",      label: "Everything else",          img: "assets/cutouts/other.png",      color: "#e0d0b8", extra: true, about: "Smaller items that don't fit a category: science, agriculture, foreign aid, job programs, and more." }
];
