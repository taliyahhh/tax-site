// "Your move": things people can actually do after seeing where their money went.
// Used by the 4th folder on the results page (js/app.js) and by move.html.
// Every link here is to an official or nonpartisan source. When the town and state are known,
// the state and city lines are filled in for that place.
//
// To add or change a link, edit ACTIONS below. Each group has a kicker (the level), a title, and items.
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // A web search for a place's own page, since the site doesn't have every city's budget link
  const search = q => "https://www.google.com/search?q=" + encodeURIComponent(q);

  function groups(place) {
    const town = place && place.city, state = place && place.stateName;
    return [
      {
        n: 1, kicker: "The nation", title: "Talk to the people who split the pile",
        items: [
          { label: "Find your U.S. representative", note: "Type your zip code to get their name, website, and phone number.", url: "https://www.house.gov/representatives/find-your-representative" },
          { label: "Find your two U.S. senators", note: "Pick your state from the list.", url: "https://www.senate.gov/senators/senators-contact.htm" },
          { label: "Comment on a proposed federal rule", note: "Anyone can leave an official public comment before a new rule is final. The agency has to read them.", url: "https://www.regulations.gov/" }
        ]
      },
      {
        n: 2, kicker: state ? state : "Your state", title: "Your state's own budget",
        items: [
          { label: state ? `Find your ${state} legislators` : "Find your state legislators", note: "Your state senator and representative vote on the state budget every year.", url: "https://pluralpolicy.com/find-your-legislator/" },
          { label: state ? `Look up ${state}'s budget` : "Look up your state's budget", note: "Most states post the governor's proposal and the final budget online.", url: search(`${state || "state"} state budget enacted`) }
        ]
      },
      {
        n: 3, kicker: town ? town : "Your town", title: "Where your voice goes furthest",
        items: [
          { label: town ? `${town} city council meetings` : "Your city council meetings", note: "Council meetings are open to the public, and most save time for public comment.", url: search(`${town ? town + " " + (state || "") : "my city"} city council meeting agenda public comment`) },
          { label: town ? `${town}'s budget hearings` : "Your city's budget hearings", note: "Cities hold hearings before they pass the budget. This is the moment to speak up.", url: search(`${town ? town + " " + (state || "") : "my city"} budget hearing`) },
          { label: "Your school board", note: "School budgets are set by the school board, and their meetings are public too.", url: search(`${town ? town + " " + (state || "") : "my"} school board meeting`) }
        ]
      },
      {
        n: 4, kicker: "Your own taxes", title: "Keep more of your own dollars",
        items: [
          { label: "File for free with IRS Free File", note: "Free guided tax software for most people under the income limit. Opens each January.", url: "https://www.irs.gov/filing/irs-free-file-do-your-taxes-for-free" },
          { label: "Get free help in person (VITA)", note: "IRS-certified volunteers do your taxes for free if you qualify, often at libraries and community centers.", url: "https://www.irs.gov/individuals/free-tax-return-preparation-for-qualifying-taxpayers" },
          { label: "Check your paycheck withholding", note: "The IRS estimator shows if too much or too little is being taken out of each paycheck.", url: "https://www.irs.gov/individuals/tax-withholding-estimator" },
          { label: "Track your refund", note: "Where's My Refund shows where your refund is.", url: "https://www.irs.gov/wheres-my-refund" }
        ]
      },
      {
        n: 5, kicker: "Every level", title: "The one that decides all of it",
        items: [
          { label: "Register to vote", note: "The official U.S. government site. It sends you to your state's sign-up page.", url: "https://vote.gov/" }
        ]
      }
    ];
  }

  // The checklist cards. Links open in a new tab so you don't lose your file.
  function html(place) {
    return `<div class="moves">` + groups(place).map(g => `
      <section class="move-card">
        <p class="move-kicker"><span class="move-n">${g.n}</span>${esc(g.kicker)}</p>
        <h3>${esc(g.title)}</h3>
        <ul class="move-list">${g.items.map(it => `
          <li><a href="${esc(it.url)}" target="_blank" rel="noopener"><span class="box" aria-hidden="true"></span><span class="move-text"><b>${esc(it.label)}</b><span>${esc(it.note)}</span></span><span class="arrow" aria-hidden="true">&nearr;</span></a></li>`).join("")}
        </ul>
      </section>`).join("") + `</div>`;
  }

  window.Actions = { html };
})();
