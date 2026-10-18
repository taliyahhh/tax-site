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
    }
  },

  // Cities are matched by name and state from the zip code lookup.
  cities: {
    "San Jose|CA": {
      name: "San José",
      short: "San José",
      period: "Fiscal year 2025-26 (Jul 2025 to Jun 2026), proposed General Fund",
      unit: 1e6,
      total: 1685.6,
      values: {
        police: 567.0,
        reserves: 345.2,   // Reserves, transfers, and citywide expenses
        emergency: 296.6,  // Fire department
        government: 219.6, // General government 142.8 + public works 57.6 + planning & permits 19.2
        parks: 137.9,
        culture: 59.4,     // Libraries 51.8 + economic development & cultural affairs 7.6
        roads: 53.5,       // Department of Transportation (streets, signals)
        water: 5.8,        // Environmental services 4.5 + energy 1.3
        housing: 0.6       // Housing dept (most housing money comes from other funds)
      },
      paidBy: "Mostly property tax and sales tax, plus utility taxes, hotel tax, and fees.",
      notes: "General Fund only. Airport, sewer, and other fee-funded services have their own budgets.",
      source: { name: "City of San José, 2025-2026 Proposed Operating Budget", url: "https://www.sanjoseca.gov/your-government/departments-offices/office-of-the-city-manager/budget" }
    },
    "Santa Clara|CA": {
      name: "Santa Clara",
      short: "Santa Clara",
      period: "Fiscal year 2025-26 (Jul 2025 to Jun 2026), adopted operating budget",
      unit: 1e6,
      total: 485.5,
      values: {
        police: 181.7,     // Police and fire together
        government: 128.9,
        roads: 98.2,       // Public works
        parks: 39.1,       // Libraries, parks & recreation together
        housing: 37.6      // Community development (planning, permits, housing)
      },
      paidBy: "Property tax and sales tax pay for most of these. The city's electric, water, and sewer utilities ($950 million) are paid by utility bills and left out.",
      notes: "The city reports police and fire as one number, and libraries with parks.",
      source: { name: "City of Santa Clara, FY 2025/26 Adopted Budget-in-Brief", url: "https://www.santaclaraca.gov/our-city/departments-a-f/finance/budget-and-financial-reports" }
    }
  }
};
