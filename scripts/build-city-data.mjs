// Builds data/cities/<STATE>.js: spending by category for every city, town, and village.
//
// Sources:
//   1. U.S. Census Bureau, 2022 Census of Governments, Individual Unit File
//      Every local government in the country, spending by function (fiscal 2022).
//   2. California State Controller's Office, City Expenditures (By the Numbers API)
//      All 482 California cities, fiscal 2023-24. Replaces the Census numbers for California.
//
// Runs on GitHub Actions (see .github/workflows/build-data.yml). Needs Node 18+ and `unzip`.
//   node scripts/build-city-data.mjs

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const OUT = "data/cities";
const WORK = ".data-work";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

const CENSUS_ZIP = "https://www2.census.gov/programs-surveys/gov-finances/tables/2022/2022_Individual_Unit_File.zip";
const CA_API = "https://bythenumbers.sco.ca.gov/resource/ju3w-4gxp.json";
const CA_YEAR = "2024"; // fiscal 2023-24, the latest the Controller has published

const FIPS = { "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY" };

// ---------- Census function codes -> our categories ----------
// Item codes are a letter (E = current operations, F = construction, G = other capital outlay,
// M = payments to other local governments) followed by a two-digit function code.
const CENSUS_FUNCTION = {
  "44": "roads", "45": "roads", "60": "roads",            // highways, toll roads, parking
  "94": "transit",                                         // transit systems
  "61": "parks",
  "12": "education", "16": "education", "18": "education", "21": "education",
  "50": "housing",
  "24": "emergency",                                       // fire protection
  "62": "police", "04": "police", "05": "police", "25": "police", "66": "police", // police, jails, courts, inspection
  "52": "culture",                                         // libraries
  "32": "health", "36": "health",                          // public health, hospitals
  "80": "water", "81": "water", "59": "water",             // sewers, garbage, natural resources
  "23": "government", "29": "government", "31": "government", // finance, central staff, public buildings
  "77": "safetynet", "79": "safetynet", "22": "safetynet",
  "03": "other", "89": "other"                             // misc commercial activities, everything else
  // Left out: 01 airports, 87 seaports, 90-93 liquor stores and water, electric, and gas utilities.
  // Those are run like businesses and paid mostly by customer fees, not taxes.
};

function censusCategory(item) {
  if (item === "I89") return "debt";                       // interest on general debt
  if (item === "J19") return "education";                  // scholarships
  if (!/^[EFGM]\d\d$/.test(item)) return null;
  return CENSUS_FUNCTION[item.slice(1)] || null;
}

// ---------- California Controller line items -> our categories ----------
const CA_LINE = {
  "Police": "police", "Animal Regulation": "police", "Weed Abatement": "police",
  "Other Public Safety 1": "police", "Other Public Safety 2": "police",
  "Fire": "emergency", "Emergency Medical Services": "emergency", "Disaster Preparedness": "emergency",
  "Street Lighting": "roads", "Streets/Highways/Storm Drains": "roads", "Streets -Trees/Landscaping": "roads", "Parking Facility": "roads",
  "Public Transit": "transit",
  "Legislative": "government", "Management and Support": "government",
  "Other General Government 1": "government", "Other General Government 2": "government",
  "Planning": "government", "Construction and Engineering Regulation": "government",
  "Libraries": "culture", "Museums": "culture",
  "Parks and Recreation": "parks", "Community Centers and Auditoriums": "parks", "Golf Courses": "parks",
  "Sports Arenas and Stadiums": "parks", "Marina and Wharfs": "parks",
  "Other Culture and Leisure 1": "parks", "Other Culture and Leisure 2": "parks",
  "Physical and Mental Health": "health", "Hospitals and Sanitariums": "health", "Cemeteries": "health",
  "Other Health 1": "health", "Other Health 2": "health",
  "Sewers": "water", "Solid Waste": "water", "Water": "water",
  "Housing": "housing", "Redevelopment": "housing",
  "Employment": "safetynet",
  "Community Promotion": "other", "Other Community Development 1": "other", "Other Community Development 2": "other",
  "Airports": "other", "Ports and Harbor": "other", "Other Transportation 1": "other", "Other Transportation 2": "other",
  "Electric": "other", "Gas": "other", "Other Public Utilities 1": "other", "Other Public Utilities 2": "other",
  "Other Expenditures 1": "other", "Other Expenditures 2": "other"
};
// Capital outlay is reported by broad function; it's split the same way as that function's day-to-day spending.
const CA_FUNCTION_LINES = {
  "Public Safety": ["Police","Animal Regulation","Weed Abatement","Other Public Safety 1","Other Public Safety 2","Fire","Emergency Medical Services","Disaster Preparedness","Street Lighting"],
  "General Government": ["Legislative","Management and Support","Other General Government 1","Other General Government 2"],
  "Transportation": ["Streets/Highways/Storm Drains","Streets -Trees/Landscaping","Parking Facility","Public Transit","Airports","Ports and Harbor","Other Transportation 1","Other Transportation 2","Street Lighting"],
  "Community Development": ["Housing","Redevelopment","Planning","Construction and Engineering Regulation","Community Promotion","Employment","Other Community Development 1","Other Community Development 2"],
  "Culture and Leisure": ["Libraries","Museums","Parks and Recreation","Community Centers and Auditoriums","Golf Courses","Sports Arenas and Stadiums","Marina and Wharfs","Other Culture and Leisure 1","Other Culture and Leisure 2"],
  "Health": ["Physical and Mental Health","Hospitals and Sanitariums","Cemeteries","Other Health 1","Other Health 2","Sewers","Solid Waste"],
  "Public Utilities": ["Water","Electric","Gas","Other Public Utilities 1","Other Public Utilities 2"],
  "Other Expenditures": ["Other Expenditures 1","Other Expenditures 2"]
};
const CA_GOV_CATEGORIES = ["General Government and Public Safety","Transportation and Community Development","Health and Culture and Leisure","Public Utilities and Other Expenditures","Debt Service and Capital Outlay"];

// ---------- helpers ----------
export function nameKey(s) {
  return s.toUpperCase()
    .replace(/\b(CITY AND BOROUGH|CITY|TOWN|VILLAGE|BOROUGH|TOWNSHIP|CHARTER TOWNSHIP|PLANTATION|CONSOLIDATED GOVERNMENT|METRO GOVERNMENT|UNIFIED GOVERNMENT)\b\s*(OF)?\s*$/, "")
    .replace(/\bST\.?\s/g, "SAINT ").replace(/\bMT\.?\s/g, "MOUNT ").replace(/\bFT\.?\s/g, "FORT ")
    .replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}
function titleCase(s) { return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }
// "SAN JOSE CITY" -> "San Jose", "HEMPSTEAD VILLAGE" -> "Village of Hempstead"
function displayName(raw) {
  const t = titleCase(raw.trim());
  const m = t.match(/^(.*) (City|Town|Village|Borough|Township)$/);
  if (!m) return t;
  return m[2] === "City" ? m[1] : `${m[2]} of ${m[1]}`;
}
function round(n) { return Math.round(n * 10) / 10; }

// ---------- 1. Census ----------
async function census() {
  const zip = path.join(WORK, "iuf.zip");
  if (!fs.existsSync(zip)) {
    const res = await fetch(CENSUS_ZIP);
    if (!res.ok) throw new Error("Census download failed: " + res.status);
    fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  }
  execSync(`unzip -o -q -j ${zip} -d ${WORK}/census`);
  const files = fs.readdirSync(`${WORK}/census`);
  const pidFile = files.find(f => /^Fin_PID/i.test(f));
  const datFile = files.find(f => /FinEstDAT/i.test(f));

  // Government names: keep municipalities (type 2) and townships (type 3)
  const units = new Map();
  for (const line of fs.readFileSync(`${WORK}/census/${pidFile}`, "latin1").split(/\r?\n/)) {
    if (line.length < 120) continue;
    const id = line.slice(0, 12), type = line[2], st = FIPS[line.slice(0, 2)];
    if (!st || (type !== "2" && type !== "3")) continue;
    units.set(id, {
      st, type,
      name: line.slice(12, 76).trim(),
      pop: parseInt(line.slice(116, 125), 10) || 0,
      fye: line.slice(140, 144).trim(),
      values: {}
    });
  }
  // Spending: amounts are in thousands of dollars
  for (const line of fs.readFileSync(`${WORK}/census/${datFile}`, "latin1").split(/\r?\n/)) {
    const u = units.get(line.slice(0, 12));
    if (!u) continue;
    const cat = censusCategory(line.slice(12, 15));
    if (!cat) continue;
    const amt = parseInt(line.slice(15, 27), 10) / 1000; // -> millions
    if (amt) u.values[cat] = (u.values[cat] || 0) + amt;
  }
  return units;
}

// ---------- 2. California Controller ----------
async function california() {
  const params = new URLSearchParams({
    "$select": "entity_name,subcategory_1,subcategory_2,sum(value)",
    "$where": `fiscal_year='${CA_YEAR}' AND type='Expenditures' AND category in(${CA_GOV_CATEGORIES.map(c => `'${c}'`).join(",")})`,
    "$group": "entity_name,subcategory_1,subcategory_2",
    "$limit": "100000"
  });
  const res = await fetch(`${CA_API}?${params}`);
  if (!res.ok) throw new Error("CA Controller API failed: " + res.status + " " + (await res.text()).slice(0, 300));
  const rows = await res.json();
  const cities = new Map();
  for (const r of rows) {
    const v = Number(r.sum_value) / 1e6;
    if (!v) continue;
    const c = cities.get(r.entity_name) || { lines: {}, capital: {}, debt: 0 };
    cities.set(r.entity_name, c);
    const line = (r.subcategory_2 || "").split("_")[0].trim();
    if (r.subcategory_1 === "Capital Outlay") c.capital[line] = (c.capital[line] || 0) + v;
    else if (r.subcategory_1 === "Debt Service") c.debt += v;
    else c.lines[line] = (c.lines[line] || 0) + v;
  }
  const out = new Map();
  for (const [name, c] of cities) {
    const values = {};
    const add = (k, v) => { if (v) values[k] = (values[k] || 0) + v; };
    for (const [line, v] of Object.entries(c.lines)) add(CA_LINE[line] || "other", v);
    for (const [fn, v] of Object.entries(c.capital)) {
      const lines = (CA_FUNCTION_LINES[fn] || []).filter(l => c.lines[l]);
      const base = lines.reduce((t, l) => t + c.lines[l], 0);
      if (!base) { add(fn === "Transportation" ? "roads" : fn === "Culture and Leisure" ? "parks" : fn === "Public Safety" ? "police" : fn === "General Government" ? "government" : "other", v); continue; }
      for (const l of lines) add(CA_LINE[l] || "other", v * c.lines[l] / base);
    }
    add("debt", c.debt);
    out.set(name, values);
  }
  return out;
}

// ---------- write files ----------
function writeState(st, entries, meta) {
  const body = {};
  for (const e of entries) body[e.key] = e.data;
  const js = `// Generated by scripts/build-city-data.mjs. Do not edit by hand.\n` +
    `window.CITY_DATA = window.CITY_DATA || {};\nwindow.CITY_DATA[${JSON.stringify(st)}] = ${JSON.stringify({ meta, cities: body })};\n`;
  fs.writeFileSync(path.join(OUT, st + ".js"), js);
}

function finish(values) {
  const v = {};
  let total = 0;
  for (const [k, n] of Object.entries(values)) { if (n > 0) { v[k] = round(n); total += n; } }
  return { values: v, total: round(total) };
}

const CENSUS_META = {
  source: { name: "U.S. Census Bureau, 2022 Census of Governments: Finance, Individual Unit File", url: "https://www.census.gov/data/datasets/2022/econ/local/public-use-datasets.html" },
  period: "Fiscal year 2022, actual spending",
  notes: "Day-to-day spending, construction, and interest on debt. Airports, seaports, and city-run utilities are left out because customer fees, not taxes, mostly pay for them."
};
const CA_META = {
  source: { name: "California State Controller's Office, City Expenditures (By the Numbers)", url: "https://bythenumbers.sco.ca.gov/" },
  period: "Fiscal year 2023-24 (Jul 2023 to Jun 2024), actual spending",
  notes: "Governmental funds: day-to-day spending, capital projects, and debt payments. City-run utilities, airports, and other services paid mostly by customer fees are left out."
};

const units = await census();
const byState = {};
for (const u of units.values()) {
  const { values, total } = finish(u.values);
  if (!total) continue;
  const key = nameKey(u.name);
  const list = (byState[u.st] ||= {});
  const prev = list[key];
  // Prefer a city or village over a town with the same name, then the bigger population
  if (prev && (prev.type < u.type || (prev.type === u.type && prev.pop >= u.pop))) continue;
  list[key] = { type: u.type, pop: u.pop, data: { name: displayName(u.name), pop: u.pop, total, values } };
}

let caCount = 0;
try {
  const ca = await california();
  const list = (byState.CA = {});
  for (const [name, raw] of ca) {
    const { values, total } = finish(raw);
    if (!total) continue;
    list[nameKey(name)] = { type: "2", pop: 0, data: { name, total, values } };
    caCount++;
  }
} catch (e) {
  console.error("California Controller data failed, keeping Census numbers for CA:", e.message);
}

let count = 0;
for (const [st, list] of Object.entries(byState)) {
  const entries = Object.entries(list).map(([key, v]) => ({ key, data: v.data }));
  count += entries.length;
  writeState(st, entries, st === "CA" && caCount ? CA_META : CENSUS_META);
}
console.log(`Wrote ${count} local governments in ${Object.keys(byState).length} states (California Controller: ${caCount}).`);
