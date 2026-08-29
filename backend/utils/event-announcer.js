const { postToPage, isFacebookConfigured } = require('./facebook');

// One entry per social network. Each is enabled purely by whether its
// credentials are present, so adding a network means adding a line here.
const CHANNELS = [
  { name: 'Facebook', isConfigured: isFacebookConfigured, post: postToPage },
];

function formatEventDate(date) {
  return new Date(date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
}

function hashtag(category) {
  const word = String(category || '').replace(/[^A-Za-z0-9]/g, '');
  return word ? `#${word}` : '';
}

// Facebook allows over 60,000 characters per post and an event can hold at most
// ~1,250 across all its fields, so unlike X there is nothing to truncate here.
// No event link either: the app has no public per-event page to link to yet.
function buildEventAnnouncement(event, groupName) {
  const blocks = [`🙌 New volunteer event: ${String(event.title).trim()}`];

  if (event.description) blocks.push(String(event.description).trim());

  const details = [`📅 ${formatEventDate(event.date)}`];
  if (event.address) details.push(`📍 ${String(event.address).trim()}`);
  details.push(`👥 ${event.maxParticipants} spots`);
  if (groupName) details.push(`🤝 ${String(groupName).trim()}`);
  blocks.push(details.join('\n'));

  const tags = ['#volunteering', hashtag(event.category)].filter(Boolean).join(' ');
  if (tags) blocks.push(tags);

  return blocks.join('\n\n');
}

// Never rejects and never throws: a failed announcement must not fail the event
// creation that triggered it, and one dead network must not stop the others.
function announceNewEvent(event, groupName) {
  const active = CHANNELS.filter((channel) => channel.isConfigured());
  if (!active.length) return Promise.resolve([]);

  let message;
  try {
    message = buildEventAnnouncement(event, groupName);
  } catch (err) {
    console.error('Could not build event announcement:', err.message);
    return Promise.resolve([]);
  }

  return Promise.all(
    active.map((channel) =>
      channel
        .post(message)
        .then((result) => {
          console.log(`Announced event ${event._id} on ${channel.name} as ${result.id}`);
          return result;
        })
        .catch((err) => {
          console.error(`Could not announce event ${event._id} on ${channel.name}:`, err.message);
          return null;
        })
    )
  );
}

module.exports = { announceNewEvent, buildEventAnnouncement };
