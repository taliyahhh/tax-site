// Spending by category for each level of government.
// Category keys match data/categories.js. Leave a category out if this government spends ~nothing on it.
// Mapping official budget lines onto our categories involves judgment calls; each one is noted in "notes".

window.BUDGETS = {
  federal: {
    name: "the federal government",
    short: "Nation",
    period: "Fiscal year 2026 (Oct 2025 to Sep 2026), actual spending",
    unit: 1e9, // values below are in billions
    total: 7396,
    values: {
      health: 2099,     // Medicare 1,073 + Health function (mostly Medicaid) 1,026
      retirement: 1667, // Social Security
      defense: 1381,    // National defense 965 + Veterans 416
      debt: 1052,       // Net interest
      safetynet: 626,   // Income security 694 minus HUD housing aid (counted under housing)
      police: 122,      // Dept of Justice 45 + Homeland Security minus FEMA 77
      education: 75,    // Dept of Education
      housing: 68,      // Dept of Housing and Urban Development
      roads: 66,        // Federal Highway Administration
      water: 39,        // EPA 17 + Interior (minus parks) 11 + Army Corps of Engineers 11
      emergency: 33,    // FEMA
      government: 31,   // Congress 7 + federal courts 10 + IRS operations 14
      transit: 28,      // Federal Transit Administration 21 + rail 7
      parks: 4.9,       // National Park Service
      culture: 2.7      // Smithsonian, Library of Congress, NEA, NEH, museum & library grants
      // "other" is calculated automatically as total minus everything above
    },
    paidBy: "Federal income tax, payroll tax (the Social Security and Medicare lines on your paycheck), corporate tax, tariffs, and about $2 trillion of borrowing.",
    notes: "Built from agency and function totals in the Treasury statement, so a few categories are approximate.",
    source: { name: "U.S. Treasury, Final Monthly Treasury Statement, FY2026", url: "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/" }
  },

  states: {
    CA: {
      name: "California",
      short: "California",
      period: "Fiscal year 2025-26 (Jul 2025 to Jun 2026), enacted General Fund",
      unit: 1e6, // millions
      total: 228368,
      values: {
        education: 99872,  // TK-14 (Prop 98) 80,738 + higher education 19,134
        health: 44600,     // Medi-Cal General Fund
        safetynet: 42269,  // Rest of Health & Human Services: in-home care, developmental services, CalWORKs
        police: 16312,     // Corrections 12,994 + courts 3,318
        government: 13974, // Legislature & executive 4,794 + government operations 2,465 + general government 6,715
        debt: 5992,        // Bond debt service
        water: 2822,       // Natural resources (includes CAL FIRE) 2,690 + environmental protection 132
        housing: 720,      // Business, consumer services & housing
        roads: 166         // Transportation (roads are mostly paid by gas tax, not the General Fund)
      },
      paidBy: "Mostly California income tax, plus sales tax and corporate tax. Roads, parks, and transit are paid mostly from gas taxes, fees, and bonds, which aren't shown here.",
      notes: "General Fund only. About $175 billion in federal money also passes through the state.",
      source: { name: "CA Department of Finance, 2025-26 Enacted Budget", url: "https://ebudget.ca.gov/" }
    },
    NY: {
      name: "New York State",
      short: "New York",
      period: "Fiscal year 2026 (Apr 2025 to Mar 2026), actual spending from state funds",
      unit: 1e6, // millions
      total: 163897,
      values: {
        education: 55688,  // School aid, SUNY, CUNY
        health: 51537,     // Includes Medicaid 39,286
        government: 18570, // General government, including state employee benefits and pensions
        roads: 10349,      // Transportation: highways plus aid to the MTA and other transit (not split out in the report)
        safetynet: 9248,   // Public welfare
        police: 6998,      // Public safety: State Police, prisons, courts
        debt: 5786,        // Repaying borrowed money
        water: 1975,       // Environment and recreation (includes state parks)
        other: 3746        // Business regulation and economic development 2,632 + revenue sharing with local governments 1,114
      },
      paidBy: "Mostly New York income tax and sales tax. Another $95 billion in federal money, mostly for Medicaid, is not included.",
      notes: "State funds only, on a cash basis. Transportation includes transit aid and parks are grouped with environment, as the Comptroller reports them.",
      source: { name: "NY State Comptroller, 2026 Financial Condition Report, Appendix 1", url: "https://www.osc.ny.gov/files/reports/finance/pdf/2026-financial-condition-report.pdf" }
    }
  },

  // Hand-entered city budgets. These override the generated data in data/cities/ (built by
  // scripts/build-city-data.mjs from the Census and the California State Controller).
  // Cities are matched by name and state from the zip code lookup.
  cities: {
    // Example: "Springfield|IL": { name, short, period, unit, total, values: {...}, paidBy, notes, source }
  }
};
