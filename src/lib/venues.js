// Turn a venue string into a map link.
//
// Two sources feed this and they do not agree. data/schedule.json says
// "Matrikel1"; Google Calendar returns the full "Matrikel1, Højbro Pl. 10, 1200
// København, Denmark". The original lookup was an exact match on the lowercased
// name, so the live value matched nothing and the venue rendered as plain text on
// production while looking correct in the static data.

// Curated pins, for places worth landing on exactly rather than searching for.
// The key is matched as a SUBSTRING, so a full postal address still finds it.
const VENUE_MAPS = {
  matrikel1: 'https://www.google.com/maps/place/Statue+of+Absalon,+1200+K%C3%B8benhavn/@55.6778579,12.5793808,20.25z/data=!4m6!3m5!1s0x46525316d942fa67:0xfcec2aee39e8fdef!8m2!3d55.677964!4d12.5799866!16s%2Fg%2F1tg5sny9',
};

// Values that are a status, not a place. Sending someone to Google Maps for
// "TBD" is worse than showing plain text.
const NOT_A_PLACE = /^(tbd|tba|online|in-?person(\s*\+\s*online)?|remote|to be (decided|confirmed))$/i;

export function venueMapUrl(name) {
  const raw = String(name || '').trim();
  if (!raw || NOT_A_PLACE.test(raw)) return null;

  const hay = raw.toLowerCase();
  const pinned = Object.keys(VENUE_MAPS).find((key) => hay.includes(key));
  if (pinned) return VENUE_MAPS[pinned];

  // Anything else is a real address or place name, so a maps search beats no
  // link. This is why item 3.4 no longer needs a curated entry per venue.
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;
}
