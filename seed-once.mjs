// One-off seeding script used to create the initial data/news.json so the site
// isn't empty on first deploy. The GitHub Action replaces this data within 30
// minutes of going live. Safe to delete.
import { writeFileSync } from "node:fs";

const now = Date.now();
let i = 0;
const it = (t, u, s) => ({ t, u, s, ts: now - i++ * 60000 });

const world = [
  it("Russian drone and missile barrage kills at least 12 in Ukraine's Kyiv", "https://www.aljazeera.com/news/2026/9/1/russian-drone-and-missile-barrage-kills-at-least-12-in-ukraines-kyiv", "Al Jazeera"),
  it("Death toll from devastating floods in China and Nepal surpasses 1,000", "https://www.aljazeera.com/news/2026/9/1/death-toll-from-devastating-floods-in-china-and-nepal-surpasses-1000", "Al Jazeera"),
  it("Israeli attacks on Gaza kill at least four, including children", "https://www.aljazeera.com/news/2026/9/1/israeli-attacks-on-gaza-kill-at-least-four-including-children", "Al Jazeera"),
  it("Heavy monsoon rains submerge Islamabad roads and underground", "https://www.aljazeera.com/video/newsfeed/2026/9/1/heavy-monsoon-rains-submerge-islamabad-roads-and-underground", "Al Jazeera"),
  it("Britons face 'risk premium' for energy as US-Israel war on Iran intensifies", "https://www.aljazeera.com/news/2026/9/1/uk-energy-price-rise-britons-face-risk-premium-for-supply-amid-iran-war", "Al Jazeera"),
  it("Could 4+4 make 1 in Libya? UN-backed agreement looks to unite rival camps", "https://www.aljazeera.com/news/2026/9/1/could-44-make-1-in-libya-un-backed-agreement-looks-to-unite-rival-camps", "Al Jazeera"),
  it("'Not welcome': How Sweden's far right took over Stockholm Central Station", "https://www.aljazeera.com/news/2026/9/1/not-welcome-how-swedens-far-right-took-over-stockholm-central-station", "Al Jazeera"),
  it("Nepal buries unidentified flood victims as families await answers", "https://www.aljazeera.com/video/newsfeed/2026/9/1/nepal-buries-unidentified-flood-victims-as-families-await-answers", "Al Jazeera"),
  it("Luxembourg drops approval for Israel bonds issue: What that means", "https://www.aljazeera.com/economy/2026/9/1/luxembourg-drops-approval-for-israel-bonds-issue-what-that-means", "Al Jazeera"),
];

const geopolitics = [
  it("The Divine Calculus of the Ukraine War's End", "https://warontherocks.com/the-divine-calculus-of-the-ukraine-wars-end/", "War on the Rocks"),
  it("A Rulebook for Surprises: Commanding Autonomous Aircraft", "https://warontherocks.com/cogs-of-war/a-rulebook-for-surprises-commanding-autonomous-aircraft/", "War on the Rocks"),
  it("The Political Constraint on America's Data-Center Power Buildout", "https://warontherocks.com/the-political-constraint-on-americas-data-center-power-buildout/", "War on the Rocks"),
  it("The Quantum Stack and the Countdown to Q-Day", "https://warontherocks.com/cogs-of-war/the-quantum-stack-and-the-countdown-to-q-day/", "War on the Rocks"),
  it("Stop Using AI. Start Commanding It", "https://warontherocks.com/stop-using-ai-start-commanding-it/", "War on the Rocks"),
  it("The Goldilocks Fallacy: The Undefined Limits of Korea's Nuclear Role", "https://warontherocks.com/the-goldilocks-fallacy-the-undefined-limits-of-koreas-nuclear-role/", "War on the Rocks"),
  it("Beneath the Surface: Overlooked Cyber Security Threats", "https://warontherocks.com/beneath-the-surface-overlooked-cyber-security-threats/", "War on the Rocks"),
  it("\"Zero Problems\" Abroad, Plenty at Home: Reassessing al Sharaa's Leadership in Syria", "https://warontherocks.com/zero-problems-abroad-plenty-at-home-reassessing-al-sharaas-leadership-in-syria/", "War on the Rocks"),
];

const tech = [
  it("The Hugging Face hack could indicate cultural issues at OpenAI", "https://www.technologyreview.com/2026/08/31/1143180/hugging-face-hack-could-indicate-cultural-issues-at-openai/", "MIT Tech Review"),
  it("How engineered microbes could help feed the world's crops", "https://www.technologyreview.com/2026/09/01/1143195/microbe-fertilizer-switch-bioworks/", "MIT Tech Review"),
  it("Making the AI-powered case for legacy modernization", "https://www.technologyreview.com/2026/09/01/1142180/making-the-ai-powered-case-for-legacy-modernization/", "MIT Tech Review"),
  it("How to sign up for a virtual power plant—and decide whether you should", "https://www.technologyreview.com/2026/08/28/1142956/how-to-sign-up-for-a-virtual-power-plant-and-decide-whether-you-should/", "MIT Tech Review"),
  it("A startup claims it's found a drug to make your blood young", "https://www.technologyreview.com/2026/08/27/1143037/startup-claims-its-found-a-drug-to-make-your-blood-young/", "MIT Tech Review"),
];

const finance = [
  it("Amazon's stock slips as the FTC alleges billions of dollars in hidden ad fees", "https://www.marketwatch.com/story/amazons-stock-slips-as-the-ftc-alleges-billions-of-dollars-in-hidden-ad-fees-4ae44ee4", "MarketWatch"),
  it("The S&P 500 usually falls in September. Why this year should be different.", "https://www.marketwatch.com/story/the-s-p-500-usually-falls-in-september-why-this-year-should-be-different-77ebb626", "MarketWatch"),
  it("Tesla's stock among S&P 500's top gainers as investors prepare for a Cybercab launch", "https://www.marketwatch.com/story/teslas-stock-is-leading-s-p-500-gainers-as-investors-prepare-for-a-cybercab-launch-f23a0d52", "MarketWatch"),
  it("This maneuver is boosting oil shipments through the Strait of Hormuz", "https://www.marketwatch.com/story/this-maneuver-is-boosting-oil-shipments-through-the-strait-of-hormuz-070d8fa3", "MarketWatch"),
  it("With Warsh running the Fed, should bond investors be worried?", "https://www.marketwatch.com/story/should-bond-investors-worry-with-warsh-running-the-fed-0a99c5ac", "MarketWatch"),
  it("23 best-performing stocks of August, as the software industry continues its recovery", "https://www.marketwatch.com/story/22-best-performing-stocks-of-august-as-the-software-industry-continues-its-recovery-88e432bf", "MarketWatch"),
];

const PLACES = {
  "Ukraine": [49, 32], "Kyiv": [50.45, 30.5], "Gaza": [31.4, 34.35], "Iran": [32, 53],
  "China": [35, 105], "Nepal": [28.4, 84.1], "Islamabad": [30, 69], "Libya": [27, 17],
  "Sweden": [62.2, 17.6], "Syria": [35, 38.5], "Korea": [36.5, 127.9],
  "Strait of Hormuz": [26.6, 56.5], "Luxembourg": [49.8, 6.1], "America": [39, -98],
};
const events = [];
for (const item of [...world, ...geopolitics]) {
  for (const [place, [lat, lng]] of Object.entries(PLACES)) {
    if (item.t.includes(place)) { events.push({ t: item.t, s: item.s, lat, lng, place }); break; }
  }
}

const payload = { updated: new Date().toISOString(), categories: { world, geopolitics, tech, finance }, events };
writeFileSync(new URL("../data/news.json", import.meta.url), JSON.stringify(payload));
console.log(`Seeded data/news.json (events:${events.length})`);
