// Map a venue name to its Google Maps location. Add more venues here and they
// link automatically wherever a venue is shown (Next session, Schedule ahead).
const VENUE_MAPS = {
  matrikel1: 'https://www.google.com/maps/place/Statue+of+Absalon,+1200+K%C3%B8benhavn/@55.6778579,12.5793808,20.25z/data=!4m6!3m5!1s0x46525316d942fa67:0xfcec2aee39e8fdef!8m2!3d55.677964!4d12.5799866!16s%2Fg%2F1tg5sny9',
};

export function venueMapUrl(name) {
  if (!name) return null;
  return VENUE_MAPS[String(name).trim().toLowerCase()] || null;
}
