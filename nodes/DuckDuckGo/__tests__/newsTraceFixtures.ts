/**
 * Synthetic English pages for the tests of example 10. Each page has an id, a site, its text, the dates it shows, the group it belongs to in
 * truth (`fam`) and a note about what it is. The stories are made up and the `.example` sites do not exist.
 */

export interface Fixture {
  id: string;
  host: string;
  fam: string | null;
  kind: string;
  text: string;
  pagePublished: string | null;
  date: string | null;
  pageContentError?: string;
}

// ---- Event 1: harbour strike, original article, 8 paragraphs ----
const P = [
  'HARBORVIEW - Dock workers at the Port of Harborview walked off the job on Tuesday morning after talks between the longshore union and the terminal operators collapsed overnight, halting the loading of about forty container ships that were due to leave the harbour this week.',
  'The union said that 3,200 members had joined the stoppage, the largest at the port since 1998, and that picket lines had been set up at all four gates of the Northern Terminal by six in the morning.',
  '"We offered to keep talking until Friday, and the operators walked away from the table," said union president Marta Keller. "Nobody here wanted a strike, but nobody here will accept a contract that cuts night shift pay by eleven percent."',
  'The terminal operators association said it had made what it called a final offer that included a four percent raise over three years and a one-time payment of 2,500 dollars to every member, and that the union had refused to put the offer to a vote.',
  'Shipping analysts estimated that each day of closure would delay roughly 90 million dollars in cargo, much of it electronics and food bound for retailers in the interior, and warned that the effect would be felt in shops within two weeks.',
  'The mayor of Harborview, Daniel Osei, urged both sides to return to mediation and offered the use of the city hall conference rooms, saying that "a port that is shut is a city that is slowly shutting down".',
  'Federal mediators were expected to arrive on Wednesday. A spokesperson for the labour department said that the government was monitoring the situation but had no plans to intervene before a mediation round had been held.',
  'The last stoppage at the port, in 2011, lasted nine days and ended after the operators agreed to restore a pension contribution that had been cut the previous year.',
];
const join = (arr: string[]) => arr.join('\n');

const CHROME_TOP = 'Skip to content\nSubscribe now\nHome News Business Sport Opinion';
const COOKIE = 'We use cookies to improve your experience on our site. By continuing to browse you agree to our use of cookies and our privacy policy. You can manage your preferences at any time in the settings.';
const FOOT_B = 'Read more: Top stories this week\nRelated: Ports brace for supply chain delays\nShare this article on social media\nSign up to our daily newsletter to get the latest news delivered to your inbox every morning.';
const FOOT_C = 'All rights reserved. Reproduction of this material without written permission is prohibited. Terms of use and privacy policy apply to all visitors of this website.';

// ---- independent report of the same event (same facts, own words) ----
const IND = [
  'Container traffic at Harborview came to a standstill on Tuesday as 3,200 longshore workers stopped work, the biggest dock action there in more than two decades. Roughly 40 vessels were left waiting at the quays.',
  'Union leader Marta Keller blamed management for the breakdown. She argued that the terminal group had refused a request for more days of bargaining and was insisting on lower night differentials, an eleven percent reduction.',
  'Employers see it differently. Their association points to a package of a 4 percent annual rise and a 2,500 dollar bonus per worker, which it says the leadership declined to take to a ballot of the rank and file.',
  'Economists at two shipping consultancies put the daily cost of the shutdown at around 90 million dollars in delayed goods. Supermarkets and electronics stores inland could see thin shelves by early next month, they said.',
  'Mayor Daniel Osei asked the sides to resume talks under a neutral chair. Mediators from the federal labour department are due on Wednesday, though officials said they would not step in until a round of mediated talks had taken place.',
  'It is the first walkout of this size since 1998. In 2011 a nine day stoppage ended when pension payments were restored.',
];

// ---- rewrite of the original that keeps ONE verbatim quote ----
const REWRITE = [
  'A strike by dock workers has closed the Port of Harborview. About 3,200 union members stopped work on Tuesday after bargaining with the terminal companies failed in the early hours, leaving around 40 container ships stuck in port.',
  'Pickets went up at each of the four entrances to the Northern Terminal before dawn. It is the largest port stoppage in Harborview in 25 years.',
  'Union president Marta Keller said the companies left the talks early. "We offered to keep talking until Friday, and the operators walked away from the table," she said, adding that the members would not take a cut to night pay.',
  'The operators say their last proposal gave a 4 percent yearly raise for three years plus a bonus of 2,500 dollars, and complain that the union would not let members vote on it.',
  'Analysts expect heavy costs, with cargo worth some 90 million dollars delayed every day, and shortages in stores in two weeks or so. Mayor Daniel Osei offered city hall as a venue for new talks.',
];

// ---- analysis article that quotes two union sentences verbatim ----
const QUOTER = [
  'Labour relations at the country\'s big ports have been deteriorating for most of the decade, and the hardening of positions seen this week is hardly a surprise to those who study the sector. Contracts that were drafted for an era of manual cargo handling are being renegotiated in the shadow of automation, and neither side trusts the other to be honest about what comes next.',
  'Union leaders say the real issue is job security rather than pay. "We offered to keep talking until Friday, and the operators walked away from the table," one union president told reporters at a picket line, repeating a line that has become the movement\'s shorthand for management bad faith.',
  'Operators counter that the cost of every idle day is borne by the whole economy and that unions have an obligation to put offers to a vote. Academics who have studied earlier disputes in Europe and Asia note that the pattern of brief strikes followed by binding arbitration is increasingly common and that settlements tend to land close to the final employer offer.',
  'What is likely to matter over the next decade is whether governments choose to treat ports as critical infrastructure, with limits on stoppages, or continue to treat them as ordinary workplaces. That question will not be settled by this dispute but it will be shaped by it.',
];

// ---- Event 2: press release pickups ----
const PR = 'Lumen Labs today announced a solid state battery cell that stores 480 watt hours per kilogram, nearly double the energy density of the lithium ion cells used in most electric vehicles today. The company said that pilot production would begin at its Dunmore plant in the second quarter of next year, with volume deliveries to automotive customers expected to start in 2029 subject to successful qualification testing.';
const LUMEN_X = [
  'Lumen Labs, a battery start-up based in Dunmore, says it has built a cell that could extend the range of electric cars by half.',
  'In a statement the company said:',
  PR,
  'Industry observers cautioned that laboratory results often take years to reach the factory floor, and that cost remains the main obstacle for solid state designs. Shares of two established cell makers fell about two percent after the news.',
  'Lumen has raised 310 million dollars from investors since it was founded in 2017.',
];
const LUMEN_Y = [
  'A new battery from Lumen Labs promises to nearly double what electric car cells can store, according to the maker. The company, which is headquartered in Dunmore, released test figures on Monday.',
  'The official announcement reads:',
  PR,
  'Several analysts we spoke to were sceptical about the timetable. One said that qualification by carmakers usually takes three to five years, so 2029 volume would be unusually fast. The start-up declined to name its customers.',
  'Lumen\'s backers include two pension funds and a sovereign wealth fund.',
];
const LUMEN_IND = [
  'Electric vehicle drivers may one day get 50 percent more range from the same pack weight if a Dunmore start-up delivers on promises made this week. Lumen Labs showed data for a solid state cell rated at 480 Wh/kg.',
  'Pilot lines are scheduled for next spring, with customer shipments targeted for 2029. Few start-ups in the field have reached mass production, and the technical hurdles include dendrite growth and the cost of ceramic separators.',
  'Competitors have made similar claims before without delivering. Investors seem unconvinced: the stock of two incumbent cell makers slipped modestly on Monday afternoon.',
];

// ---- unrelated local news used for boilerplate-only overlap ----
const SCHOOL = [
  'The Mill Creek school board voted five to two on Monday evening to close Alder Elementary at the end of the school year, citing a decline in enrolment of nearly a third over six years and a repair bill for the roof and boiler of 4.2 million dollars.',
  'Parents who filled the gymnasium for the meeting said the decision would force young children onto longer bus rides and break up a tight community. Several asked the board to delay the vote until the results of a traffic study were available.',
  'Superintendent Helen Brandt said students would be reassigned to Cedar Park and Linden Street schools, and that transport routes would be published by the end of the month.',
];
const BANK = [
  'Regional lender Corvane Bank reported a quarterly profit of 212 million dollars on Thursday, beating forecasts as net interest income rose seven percent and provisions for bad loans fell for the third quarter in a row.',
  'Chief executive Paul Dunmore told analysts the bank would keep its dividend unchanged and continue to buy back shares while it waited for clarity on capital rules. The shares rose three percent in early trading.',
  'Corvane also said it had closed 14 branches during the quarter as customers moved to its mobile app.',
];

function words(s: string) { return s.split(/\s+/); }
// Truncate to the first n words of the joined text.
function firstWords(text: string, n: number) { return words(text).slice(0, n).join(' '); }

// light copy-edit: replace a few words
function lightEdit(text: string) {
  return text
    .replace('said that', 'told reporters that')
    .replace('about forty', 'roughly 40')
    .replace('urged both sides', 'called on both sides')
    .replace('collapsed overnight', 'broke down overnight')
    .replace('Shipping analysts', 'Industry analysts');
}

export const docs: Fixture[] = [];
function add(d: Fixture) { docs.push(d); }

// Reference "now" for date tests: the harness passes it in.
add({ id: 'orig', host: 'gazette.example', fam: 'F1', kind: 'original', text: 'By Staff Reporter\n' + join(P),
  pagePublished: '2026-10-27T08:41:00Z', date: '2026-10-27T09:10:00Z' });
add({ id: 'wireB', host: 'sitebee.example', fam: 'F1', kind: 'verbatim copy + chrome', text: CHROME_TOP + '\n' + join(P) + '\n' + COOKIE + '\n' + FOOT_B,
  pagePublished: '2026-10-27T10:02:00Z', date: '2026-10-27T10:30:00Z' });
add({ id: 'wireC', host: 'citypress.example', fam: 'F1', kind: 'light edit (5 phrases)', text: 'HARBORVIEW (Wire) -\n' + lightEdit(join(P)) + '\n' + FOOT_C,
  pagePublished: null, date: '2026-10-27T11:00:00Z' });
add({ id: 'edited', host: 'dailybugle.example', fam: 'F1', kind: 'edited: 5 of 8 paras + local para', text:
  [P[0], P[1], P[3], P[4], P[6], 'Local business owners on the waterfront said they were already seeing fewer customers, with two restaurants near the Northern Terminal cutting lunch hours until the dispute is settled.'].join('\n'),
  pagePublished: '2026-10-27T12:15:00Z', date: '2026-10-27T12:15:00Z' });
add({ id: 'short2', host: 'quickbrief.example', fam: 'F1', kind: 'short copy: first 2 paras only', text: P[0] + '\n' + P[1],
  pagePublished: '2026-10-27T09:30:00Z', date: '2026-10-27T09:35:00Z' });
add({ id: 'trunc', host: 'slowsite.example', fam: 'F1', kind: 'truncated copy (first 90 words)', text: firstWords(join(P), 90),
  pagePublished: '2026-10-27T13:00:00Z', date: '2026-10-27T13:00:00Z' });
add({ id: 'trunc30', host: 'tiny.example', fam: 'F1?', kind: 'truncated copy (first 30 words)', text: firstWords(join(P), 30),
  pagePublished: null, date: '2026-10-27T13:20:00Z' });
add({ id: 'rewrite', host: 'metrotimes.example', fam: 'R1', kind: 'rewrite sharing ONE quote', text: join(REWRITE),
  pagePublished: '2026-10-27T11:40:00Z', date: '2026-10-27T11:40:00Z' });
add({ id: 'indep', host: 'wirelessnews.example', fam: 'I1', kind: 'independent report, same facts', text: join(IND),
  pagePublished: '2026-10-27T09:55:00Z', date: '2026-10-27T10:00:00Z' });
add({ id: 'quoter', host: 'longread.example', fam: 'Q1', kind: 'analysis quoting a sentence', text: join(QUOTER),
  pagePublished: '2026-10-28T07:00:00Z', date: '2026-10-28T07:00:00Z' });
add({ id: 'empty', host: 'paywalled.example', fam: null, kind: 'empty page', text: '', pagePublished: null, date: '2026-10-27T09:00:00Z' });
add({ id: 'errpage', host: 'blocked.example', fam: null, kind: 'fetch error', text: '', pageContentError: 'HTTP 403', pagePublished: null, date: '2026-10-27T09:05:00Z' });
add({ id: 'schoolB', host: 'sitebee.example', fam: 'S1', kind: 'unrelated, same chrome as wireB', text: CHROME_TOP + '\n' + join(SCHOOL) + '\n' + COOKIE + '\n' + FOOT_B,
  pagePublished: '2026-10-27T10:20:00Z', date: '2026-10-27T10:20:00Z' });
add({ id: 'bankB', host: 'sitebee.example', fam: 'B1', kind: 'unrelated, same chrome as wireB', text: CHROME_TOP + '\n' + join(BANK) + '\n' + COOKIE + '\n' + FOOT_B,
  pagePublished: '2026-10-27T10:25:00Z', date: '2026-10-27T10:25:00Z' });
add({ id: 'lumenX', host: 'techwire.example', fam: 'L1', kind: 'own article quoting press release', text: join(LUMEN_X),
  pagePublished: '2026-10-26T15:00:00Z', date: '2026-10-26T15:05:00Z' });
add({ id: 'lumenY', host: 'evdaily.example', fam: 'L2', kind: 'own article quoting same press release', text: join(LUMEN_Y),
  pagePublished: '2026-10-26T16:30:00Z', date: '2026-10-26T16:30:00Z' });
add({ id: 'lumenXcopy', host: 'mirror.example', fam: 'L1', kind: 'verbatim copy of lumenX', text: CHROME_TOP + '\n' + join(LUMEN_X) + '\n' + FOOT_C,
  pagePublished: '2026-10-26T17:00:00Z', date: '2026-10-26T17:00:00Z' });
add({ id: 'lumenInd', host: 'autoblog.example', fam: 'I2', kind: 'independent report of press release', text: join(LUMEN_IND),
  pagePublished: '2026-10-26T18:00:00Z', date: '2026-10-26T18:00:00Z' });
add({ id: 'prOnly', host: 'lumenlabs.example', fam: 'PR', kind: 'the press release itself (short)', text: 'Lumen Labs announces record energy density solid state cell\n' + PR,
  pagePublished: '2026-10-26T13:00:00Z', date: '2026-10-26T13:00:00Z' });
add({ id: 'roundup', host: 'digest.example', fam: 'MIX', kind: 'roundup: 2 paras of F1 + 3 of L1', text: [P[0], P[1], LUMEN_X[0], LUMEN_X[1], PR].join('\n'),
  pagePublished: '2026-10-28T06:00:00Z', date: '2026-10-28T06:00:00Z' });
add({ id: 'legalA', host: 'finwire.example', fam: 'D1', kind: 'unrelated, shared legal disclaimer', text: 'Shares of Corvane rose after results.\n' + 'Forward looking statements in this release involve risks and uncertainties that could cause actual results to differ materially from those expressed or implied, including changes in economic conditions, regulatory developments and the timing of customer decisions. The company undertakes no obligation to update any forward looking statement except as required by law.',
  pagePublished: null, date: '2026-10-27T09:00:00Z' });
add({ id: 'legalB', host: 'bizlog.example', fam: 'D2', kind: 'unrelated, shared legal disclaimer', text: 'Harborview terminal operators issued a short notice to customers on Tuesday.\n' + 'Forward looking statements in this release involve risks and uncertainties that could cause actual results to differ materially from those expressed or implied, including changes in economic conditions, regulatory developments and the timing of customer decisions. The company undertakes no obligation to update any forward looking statement except as required by law.',
  pagePublished: null, date: '2026-10-27T09:00:00Z' });
add({ id: 'wireD', host: 'ruralpost.example', fam: 'F1', kind: 'verbatim copy, different order of 2 paras', text: join([P[0], P[1], P[2], P[3], P[4], P[5], P[7], P[6]]),
  pagePublished: '2026-10-27T14:00:00Z', date: '2026-10-27T14:00:00Z' });
add({ id: 'orig2', host: 'harborradio.example', fam: 'F1', kind: 'verbatim copy, no chrome, "updated" date later', text: join(P),
  pagePublished: '2026-10-27T15:00:00Z', date: '2026-10-27T08:50:00Z' });

export { P, QUOTER, REWRITE, IND, PR };
