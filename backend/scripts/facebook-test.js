// Previews the announcement and checks the Page credentials. Reads are free and
// nothing is published unless you pass --post.
//
//   npm run facebook:test
//   npm run facebook:test -- --post
require('dotenv').config();

const { postToPage, verifyPageAccess, isFacebookConfigured } = require('../utils/facebook');
const { buildEventAnnouncement } = require('../utils/event-announcer');

const SAMPLE_EVENT = {
  title: 'Beach cleanup at Tel Baruch',
  category: 'Environment',
  description: 'Bring gloves and a hat. Bags and refreshments are on us, and we finish with coffee on the promenade.',
  address: 'Tel Baruch Beach, Tel Aviv-Yafo, Israel',
  date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  maxParticipants: 30,
};

const SAMPLE_GROUP_NAME = 'Clean Coast Volunteers';

async function main() {
  const shouldPost = process.argv.includes('--post');
  const message = buildEventAnnouncement(SAMPLE_EVENT, SAMPLE_GROUP_NAME);

  console.log('--- preview ---');
  console.log(message);
  console.log('---------------');

  if (!isFacebookConfigured()) {
    console.log('Credentials: missing.');
    console.log('Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN in backend/.env.');
    return;
  }

  // Reading a Page needs pages_read_engagement while posting needs
  // pages_manage_posts, so a failed read is a warning, not a reason to stop.
  try {
    const page = await verifyPageAccess();
    console.log(`Page access: OK. Target is "${page.name}" (${page.id}).`);
  } catch (err) {
    console.warn(`Page access check failed: ${err.message}`);
    console.warn("This check needs pages_read_engagement. Posting needs pages_manage_posts, so continuing.");
  }

  if (!shouldPost) {
    console.log('\nDry run. Re-run with --post to publish this to the Page for real.');
    return;
  }

  const post = await postToPage(message);
  console.log(`\nPublished: https://www.facebook.com/${post.id}`);
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
