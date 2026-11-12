/**
 * Calendars fetched directly every week (spec §5). Each URL was loaded on 2026-11-12 and returned dated
 * upcoming events in plain HTML. Seeded into the profile by scripts/seed-profile.ts; edit the profile after that.
 *
 * Left out (no usable plain HTML): Carlsbad Chamber (JS-rendered), CalCPA San Diego (JS), CSUSM main calendar
 * (Trumba JS), MiraCosta events (Trumba JS), UCSD Extended Studies (JS), MiraCosta LIFE lectures (PDF).
 * Blocked (403 to automated fetches): Solana Beach Chamber, SD County Dental Society, Carlsbad City Library,
 * Carlsbad and Encinitas senior centers. Not found: Del Mar chamber, RSF Association calendar with titles.
 */
export const TRUSTED_SOURCES: { name: string; url: string }[] = [
  { name: "San Diego Regional Chamber of Commerce", url: "https://sdchamber.org/events/" },
  { name: "North San Diego Business Chamber", url: "https://chamber.sdbusinesschamber.com/events" },
  { name: "Encinitas Chamber of Commerce", url: "https://local.encinitaschamber.com/events/" },
  { name: "Del Mar Village Association", url: "https://www.visitdelmarvillage.com/events/" },
  {
    name: "San Diego County Medical Society",
    url: "https://my.sdcms.org/cv/cgi-bin/eventsdll.dll/eventlist?lastregisterdate=%3egetdate()-1&Range=1%2f10&ONWEBFLG=Y&REGONLINE=Y&SORT=TOPRINTFLG+DESC%2csessionbegdate",
  },
  { name: "San Diego County Bar Association", url: "https://www.sdcba.org/?pg=events" },
  { name: "Rotary Club of Carlsbad", url: "https://www.carlsbadrotary.com/" },
  { name: "Carlsbad Hi-Noon Rotary", url: "https://www.carlsbadhinoonrotary.org/" },
  { name: "Encinitas Rotary Club", url: "https://encinitasrotary.com/" },
  { name: "Coastal Encinitas Rotary", url: "https://coastalencinitasrotary.org/events-calendar/" },
  { name: "Rotary Club of Del Mar", url: "https://www.delmarrotary.org/" },
  { name: "Del Mar-Solana Beach Rotary", url: "https://www.dmsbrotary.com/" },
  { name: "Rancho Santa Fe Rotary", url: "https://www.rsfrotary.com/" },
  { name: "NAWBO San Diego", url: "https://nawbo.org/san-diego/events/" },
  { name: "San Diego County Library", url: "https://sdcl.bibliocommons.com/v2/events" },
  { name: "Encinitas Library", url: "https://sdcl.bibliocommons.com/v2/events?locations=14" },
  { name: "Rady Children's Hospital Foundation", url: "https://radyfoundation.org/get-involved/events/" },
  { name: "Scripps Health Foundation", url: "https://giving.scripps.org/what-we-do/scripps-health-foundation-events" },
  { name: "Sharp HealthCare Foundations (incl. Tri-City)", url: "https://www.sharp.com/give/events" },
  { name: "Palomar Health Foundation", url: "https://www.palomarhealthfoundation.org/events/list/" },
  { name: "CSUSM CSTEM Career Events", url: "https://www.csusm.edu/cstem/career-readiness/upcoming_career_events.html" },
  { name: "Palomar College Events", url: "https://www.palomar.edu/calendar/events/" },
];
