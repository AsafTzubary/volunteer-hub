require('dotenv').config();
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const https = require('https');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');
const Group = require('./models/Group');
const Post = require('./models/Post');
const Event = require('./models/Event');

const UPLOADS_DIR = path.join(__dirname, '../public/uploads');

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

function makeSolidColorPNG(width, height, r, g, b) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < width; x++) {
      raw[y * rowSize + 1 + x * 3] = r;
      raw[y * rowSize + 1 + x * 3 + 1] = g;
      raw[y * rowSize + 1 + x * 3 + 2] = b;
    }
  }
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function saveImage(r, g, b) {
  const filename = `seed-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), makeSolidColorPNG(400, 300, r, g, b));
  return '/uploads/' + filename;
}

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function httpsGet(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function resolvePlace(address) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const fields = 'formatted_address,geometry';
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(address)}&inputtype=textquery&fields=${fields}&key=${key}`;
  const data = await httpsGet(url);
  if (!data || data.status !== 'OK' || !data.candidates?.length) return null;
  const { formatted_address, geometry } = data.candidates[0];
  return {
    address: formatted_address,
    latitude: geometry.location.lat,
    longitude: geometry.location.lng,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeEvents(events) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    console.log('No GOOGLE_MAPS_API_KEY found — using hardcoded coordinates.');
    return events;
  }
  console.log(`Resolving ${events.length} event addresses via Google Places API...`);
  const result = [];
  for (const event of events) {
    const place = await resolvePlace(event.address);
    if (place) {
      console.log(`  ✓ ${place.address}`);
      result.push({ ...event, ...place });
    } else {
      console.warn(`  ✗ Could not resolve: "${event.address}" — using fallback coords.`);
      result.push(event);
    }
    await sleep(150);
  }
  return result;
}

async function seed() {
  await connectDB();

  await Promise.all([
    User.deleteMany({}),
    Group.deleteMany({}),
    Post.deleteMany({}),
    Event.deleteMany({}),
  ]);
  console.log('Cleared existing data.');

  const hash = await bcrypt.hash('password', 10);

  const users = await User.insertMany([
    { username: 'admin',         passwordHash: hash, fullName: 'Admin User',      email: 'admin@volunteerhub.com',  city: 'New York',      interests: ['community', 'leadership'],              role: 'admin' },
    { username: 'sarahjones',   passwordHash: hash, fullName: 'Sarah Jones',     email: 'sarah@example.com',       city: 'New York',      interests: ['environment', 'animals', 'gardening'] },
    { username: 'mikechen',     passwordHash: hash, fullName: 'Mike Chen',       email: 'mike@example.com',        city: 'San Francisco', interests: ['education', 'youth', 'technology'] },
    { username: 'emilypark',    passwordHash: hash, fullName: 'Emily Park',      email: 'emily@example.com',       city: 'Chicago',       interests: ['food', 'community', 'cooking'] },
    { username: 'rachelbrown',  passwordHash: hash, fullName: 'Rachel Brown',    email: 'rachel@example.com',      city: 'Boston',        interests: ['animals', 'community', 'fostering'] },
    { username: 'davidkim',     passwordHash: hash, fullName: 'David Kim',       email: 'david@example.com',       city: 'Austin',        interests: ['health', 'outdoors', 'fitness'] },
    { username: 'lisagarcia',   passwordHash: hash, fullName: 'Lisa Garcia',     email: 'lisa@example.com',        city: 'Miami',         interests: ['arts', 'seniors', 'music'] },
    { username: 'tomwilson',    passwordHash: hash, fullName: 'Tom Wilson',      email: 'tom@example.com',         city: 'Seattle',       interests: ['environment', 'hiking', 'outdoors'] },
    { username: 'jamestaylor',  passwordHash: hash, fullName: 'James Taylor',    email: 'james@example.com',       city: 'Denver',        interests: ['health', 'sports', 'mentoring'] },
    { username: 'annawhite',    passwordHash: hash, fullName: 'Anna White',      email: 'anna@example.com',        city: 'Portland',      interests: ['arts', 'food', 'sustainability'] },
    { username: 'carlosrivera', passwordHash: hash, fullName: 'Carlos Rivera',   email: 'carlos@example.com',      city: 'Los Angeles',   interests: ['seniors', 'healthcare', 'community'] },
    { username: 'mayapatel',    passwordHash: hash, fullName: 'Maya Patel',      email: 'maya@example.com',        city: 'Austin',        interests: ['technology', 'education', 'innovation'] },
  ]);
  console.log(`Created ${users.length} users.`);

  const by = Object.fromEntries(users.map(u => [u.username, u]));

  const groupsData = [
    {
      name: 'Green City Initiative',
      category: 'Environment',
      description: 'We organize urban clean-ups, tree planting events, and sustainability workshops to make our city greener and healthier for everyone.',
      address: '120 Park Ave, New York, NY',
      latitude: 40.7484, longitude: -73.9967,
      manager: by['sarahjones']._id,
      members: [by['sarahjones']._id, by['tomwilson']._id, by['annawhite']._id, by['emilypark']._id, by['admin']._id],
    },
    {
      name: 'Youth Education Hub',
      category: 'Education',
      description: 'Connecting volunteers with schools and after-school programs to provide tutoring, mentorship, and enrichment activities for underserved youth.',
      address: '55 Mission St, San Francisco, CA',
      latitude: 37.7886, longitude: -122.3994,
      manager: by['mikechen']._id,
      members: [by['mikechen']._id, by['jamestaylor']._id, by['mayapatel']._id, by['admin']._id, by['lisagarcia']._id],
    },
    {
      name: 'Community Kitchen',
      category: 'Food & Community',
      description: 'A volunteer-run kitchen preparing and delivering nutritious meals to families in need across the city. Join us to cook, pack, and deliver!',
      address: '890 N Michigan Ave, Chicago, IL',
      latitude: 41.8966, longitude: -87.6239,
      manager: by['emilypark']._id,
      members: [by['emilypark']._id, by['annawhite']._id, by['rachelbrown']._id, by['davidkim']._id, by['carlosrivera']._id],
    },
    {
      name: 'Paws & Claws Rescue',
      category: 'Animals',
      description: 'We rescue, foster, and rehome animals in need. Volunteers help with sheltering, transport, adoption events, and community education.',
      address: '240 Newbury St, Boston, MA',
      latitude: 42.3509, longitude: -71.0761,
      manager: by['rachelbrown']._id,
      members: [by['rachelbrown']._id, by['sarahjones']._id, by['emilypark']._id, by['lisagarcia']._id, by['annawhite']._id],
    },
    {
      name: 'City Health Runners',
      category: 'Health & Fitness',
      description: 'We run for a cause! Every weekend we organize charity runs and fitness events, raising money for local health clinics and food banks.',
      address: '1100 Barton Springs Rd, Austin, TX',
      latitude: 30.2672, longitude: -97.7431,
      manager: by['davidkim']._id,
      members: [by['davidkim']._id, by['jamestaylor']._id, by['tomwilson']._id, by['mayapatel']._id, by['admin']._id],
    },
    {
      name: 'Arts for All',
      category: 'Arts & Culture',
      description: 'Bringing art into underserved communities through workshops, murals, and performances. Everyone deserves access to creative expression.',
      address: '700 Brickell Ave, Miami, FL',
      latitude: 25.7617, longitude: -80.1918,
      manager: by['lisagarcia']._id,
      members: [by['lisagarcia']._id, by['annawhite']._id, by['rachelbrown']._id, by['carlosrivera']._id, by['sarahjones']._id],
    },
    {
      name: 'Trail Blazers Hiking Club',
      category: 'Outdoors',
      description: 'We explore the Pacific Northwest trails while giving back — organizing trail maintenance days, litter picks, and guided hikes for newcomers.',
      address: '200 Second Ave, Seattle, WA',
      latitude: 47.6062, longitude: -122.3321,
      manager: by['tomwilson']._id,
      members: [by['tomwilson']._id, by['davidkim']._id, by['jamestaylor']._id, by['sarahjones']._id, by['mikechen']._id],
    },
    {
      name: 'Sports for Good',
      category: 'Sports & Recreation',
      description: 'Using the power of sport to build community. We run leagues, tournaments, and coaching clinics for youth and adults in low-income neighborhoods.',
      address: '2001 Blake St, Denver, CO',
      latitude: 39.7559, longitude: -104.9942,
      manager: by['jamestaylor']._id,
      members: [by['jamestaylor']._id, by['davidkim']._id, by['tomwilson']._id, by['mikechen']._id, by['mayapatel']._id],
    },
    {
      name: 'Sustainable Living Co-op',
      category: 'Sustainability',
      description: 'A community co-op focused on zero-waste living, composting, urban farming, and swapping skills. Building a more sustainable future, one household at a time.',
      address: '408 NW Couch St, Portland, OR',
      latitude: 45.5231, longitude: -122.6765,
      manager: by['annawhite']._id,
      members: [by['annawhite']._id, by['sarahjones']._id, by['mayapatel']._id, by['emilypark']._id, by['tomwilson']._id],
    },
    {
      name: 'Senior Care Network',
      category: 'Healthcare',
      description: 'We connect volunteers with elderly community members who need companionship, rides to appointments, grocery help, and home visits.',
      address: '6300 Wilshire Blvd, Los Angeles, CA',
      latitude: 34.0626, longitude: -118.3717,
      manager: by['carlosrivera']._id,
      members: [by['carlosrivera']._id, by['lisagarcia']._id, by['mikechen']._id, by['emilypark']._id, by['admin']._id],
    },
    {
      name: 'Tech for Good',
      category: 'Technology',
      description: 'Volunteers with tech skills helping nonprofits, small businesses, and seniors get online. We teach digital literacy and build websites for community organizations.',
      address: '701 Brazos St, Austin, TX',
      latitude: 30.2669, longitude: -97.7428,
      manager: by['mayapatel']._id,
      members: [by['mayapatel']._id, by['mikechen']._id, by['jamestaylor']._id, by['carlosrivera']._id, by['davidkim']._id],
    },
    {
      name: 'Neighborhood Watch Alliance',
      category: 'Community Safety',
      description: 'Working with local law enforcement and city officials to keep our neighborhoods safe through community patrols, education programs, and emergency preparedness.',
      address: '1 Centre St, New York, NY',
      latitude: 40.7128, longitude: -74.0059,
      manager: by['admin']._id,
      members: [by['admin']._id, by['carlosrivera']._id, by['lisagarcia']._id, by['rachelbrown']._id, by['annawhite']._id],
    },
  ];

  const groups = await Group.insertMany(groupsData);
  console.log(`Created ${groups.length} groups.`);

  for (const group of groups) {
    for (const memberId of group.members) {
      await User.updateOne({ _id: memberId }, { $addToSet: { joinedGroups: group._id } });
    }
  }

  const friendPairs = [
    ['sarahjones',   'tomwilson'],
    ['sarahjones',   'annawhite'],
    ['sarahjones',   'rachelbrown'],
    ['mikechen',     'jamestaylor'],
    ['mikechen',     'mayapatel'],
    ['emilypark',    'annawhite'],
    ['emilypark',    'rachelbrown'],
    ['davidkim',     'jamestaylor'],
    ['davidkim',     'tomwilson'],
    ['lisagarcia',   'rachelbrown'],
    ['lisagarcia',   'carlosrivera'],
    ['carlosrivera', 'mayapatel'],
    ['jamestaylor',  'tomwilson'],
    ['annawhite',    'mayapatel'],
  ];
  for (const [a, b] of friendPairs) {
    await Promise.all([
      User.updateOne({ _id: by[a]._id }, { $addToSet: { friends: by[b]._id } }),
      User.updateOne({ _id: by[b]._id }, { $addToSet: { friends: by[a]._id } }),
    ]);
  }
  console.log(`Created ${friendPairs.length} friend pairs.`);

  const [
    greenGroup, eduGroup, kitchenGroup, pawsGroup,
    runnersGroup, artsGroup, hikingGroup, sportsGroup,
    sustainGroup, seniorGroup, techGroup, watchGroup,
  ] = groups;

  const eventsData = [
    // Green City Initiative
    { title: 'Central Park Clean-Up Day',     category: 'Environment',       description: 'Monthly park clean-up. Gloves and bags provided. Meet at the south entrance.',                          address: 'Central Park South Entrance, New York, NY',  date: daysFromNow(7),  maxParticipants: 50,  group: greenGroup._id,   manager: by['sarahjones']._id },
    { title: 'Tree Planting Workshop',         category: 'Environment',       description: 'Learn to plant and care for urban trees. We are planting 20 saplings in Riverside Park.',              address: 'Riverside Park, New York, NY',               date: daysFromNow(21), maxParticipants: 30,  group: greenGroup._id,   manager: by['sarahjones']._id },
    { title: 'Sustainability Fair',            category: 'Environment',       description: 'Community fair showcasing sustainable living tips, local vendors, and zero-waste workshops.',           address: 'Union Square, New York, NY',                 date: daysFromNow(45), maxParticipants: 200, group: greenGroup._id,   manager: by['sarahjones']._id },
    // Youth Education Hub
    { title: 'Tutoring Volunteer Kickoff',     category: 'Education',         description: 'Orientation for new tutoring volunteers. Get matched with students.',                                   address: '55 Mission St, San Francisco, CA',           date: daysFromNow(10), maxParticipants: 40,  group: eduGroup._id,     manager: by['mikechen']._id },
    { title: 'STEM Workshop for Kids',         category: 'Education',         description: 'Hands-on science and coding activities for kids ages 8-14. Volunteers needed to lead stations.',        address: 'SF Public Library, San Francisco, CA',       date: daysFromNow(28), maxParticipants: 60,  group: eduGroup._id,     manager: by['mikechen']._id },
    { title: 'Reading Buddies Program Launch', category: 'Education',         description: 'Launch event for our paired reading program matching adult volunteers with early readers.',              address: 'SF Community Center, San Francisco, CA',    date: daysFromNow(50), maxParticipants: 30,  group: eduGroup._id,     manager: by['mikechen']._id },
    // Community Kitchen
    { title: 'Saturday Meal Prep Session',     category: 'Food & Community',  description: 'Help prepare 300 meals for local shelters. No cooking experience required!',                           address: '890 N Michigan Ave, Chicago, IL',            date: daysFromNow(5),  maxParticipants: 25,  group: kitchenGroup._id, manager: by['emilypark']._id },
    { title: 'Holiday Feast — All Hands',      category: 'Food & Community',  description: 'Our biggest event: cooking and serving a holiday feast for 500 community members.',                    address: 'Chicago Community Center, Chicago, IL',     date: daysFromNow(60), maxParticipants: 80,  group: kitchenGroup._id, manager: by['emilypark']._id },
    { title: 'Urban Farming Workshop',         category: 'Food & Community',  description: 'Learn to grow your own vegetables and herbs, even in a small city apartment.',                         address: 'Lincoln Park, Chicago, IL',                 date: daysFromNow(35), maxParticipants: 40,  group: kitchenGroup._id, manager: by['emilypark']._id },
    // Paws & Claws Rescue
    { title: 'Adoption Fair at Boston Common', category: 'Animals',           description: 'Help find forever homes for our rescued animals. Volunteers needed for setup and animal handling.',    address: 'Boston Common, Boston, MA',                 date: daysFromNow(14), maxParticipants: 35,  group: pawsGroup._id,    manager: by['rachelbrown']._id },
    { title: 'Foster Family Orientation',      category: 'Animals',           description: 'Come learn everything you need to know about welcoming an animal into your home temporarily.',         address: '240 Newbury St, Boston, MA',                date: daysFromNow(30), maxParticipants: 20,  group: pawsGroup._id,    manager: by['rachelbrown']._id },
    { title: 'Animal Shelter Makeover Day',    category: 'Animals',           description: 'Help us repaint and renovate our shelter space to make it more comfortable for animals and visitors.',  address: '15 Humane Way, Boston, MA',                 date: daysFromNow(55), maxParticipants: 25,  group: pawsGroup._id,    manager: by['rachelbrown']._id },
    // City Health Runners
    { title: '5K Charity Run for Clinics',     category: 'Health & Fitness',  description: 'A 5K fun run raising funds for free health clinics. All fitness levels welcome.',                      address: 'Zilker Park, Austin, TX',                   date: daysFromNow(12), maxParticipants: 150, group: runnersGroup._id, manager: by['davidkim']._id },
    { title: 'Morning Yoga & Mindfulness',     category: 'Health & Fitness',  description: 'Free community yoga session open to all. Donations go to local mental health services.',              address: 'Republic Square Park, Austin, TX',          date: daysFromNow(6),  maxParticipants: 60,  group: runnersGroup._id, manager: by['davidkim']._id },
    { title: 'Trail Cleanup Run',              category: 'Health & Fitness',  description: 'Combine your weekend run with a trail cleanup. Bags and gloves provided at the start line.',           address: 'Barton Creek Greenbelt, Austin, TX',         date: daysFromNow(25), maxParticipants: 40,  group: runnersGroup._id, manager: by['davidkim']._id },
    // Arts for All
    { title: 'Community Mural Painting',       category: 'Arts & Culture',    description: 'Help paint a large mural celebrating Miami\'s cultural diversity. All skill levels welcome.',          address: 'Wynwood Walls, Miami, FL',                  date: daysFromNow(9),  maxParticipants: 30,  group: artsGroup._id,    manager: by['lisagarcia']._id },
    { title: 'Kids Art Workshop',              category: 'Arts & Culture',    description: 'Teaching painting and drawing to children ages 5-12 at a local community center.',                   address: 'Overtown Youth Center, Miami, FL',          date: daysFromNow(18), maxParticipants: 25,  group: artsGroup._id,    manager: by['lisagarcia']._id },
    { title: 'Open Mic & Fundraiser Night',    category: 'Arts & Culture',    description: 'Community open mic event raising funds for arts programs in public schools.',                         address: 'The Fillmore Miami Beach, Miami, FL',       date: daysFromNow(40), maxParticipants: 100, group: artsGroup._id,    manager: by['lisagarcia']._id },
    // Trail Blazers Hiking Club
    { title: 'Mt. Rainier Day Hike',           category: 'Outdoors',          description: 'Guided intermediate hike to Skyline Trail. All participants must be comfortable with 8-mile hikes.',   address: 'Mt. Rainier National Park, WA',             date: daysFromNow(16), maxParticipants: 20,  group: hikingGroup._id,  manager: by['tomwilson']._id },
    { title: 'Trail Maintenance Workday',      category: 'Outdoors',          description: 'Help maintain local trails — clearing brush, fixing erosion, installing signage.',                    address: 'Tiger Mountain State Forest, WA',           date: daysFromNow(8),  maxParticipants: 25,  group: hikingGroup._id,  manager: by['tomwilson']._id },
    { title: 'Beginner Hike: Discovery Park',  category: 'Outdoors',          description: 'An easy 3-mile guided walk through Discovery Park, perfect for first-timers.',                        address: 'Discovery Park, Seattle, WA',               date: daysFromNow(22), maxParticipants: 35,  group: hikingGroup._id,  manager: by['tomwilson']._id },
    // Sports for Good
    { title: 'Youth Basketball Clinic',        category: 'Sports & Recreation', description: 'Free basketball skills clinic for youth ages 10-17. Coaches and referees needed.',                 address: 'Denver Recreation Center, Denver, CO',     date: daysFromNow(11), maxParticipants: 50,  group: sportsGroup._id,  manager: by['jamestaylor']._id },
    { title: 'Community Soccer Tournament',    category: 'Sports & Recreation', description: 'Friendly 5-a-side tournament raising funds for youth sports equipment grants.',                    address: 'Civic Center Park, Denver, CO',             date: daysFromNow(33), maxParticipants: 80,  group: sportsGroup._id,  manager: by['jamestaylor']._id },
    { title: 'Sports Equipment Drive & Sort',  category: 'Sports & Recreation', description: 'Help sort and distribute donated sports equipment to schools that can not afford it.',             address: 'Sports for Good Warehouse, Denver, CO',    date: daysFromNow(19), maxParticipants: 20,  group: sportsGroup._id,  manager: by['jamestaylor']._id },
    // Sustainable Living Co-op
    { title: 'Zero-Waste Cooking Class',       category: 'Sustainability',    description: 'Learn to cook delicious meals using vegetable scraps and near-expiry ingredients. No waste!',         address: '408 NW Couch St, Portland, OR',             date: daysFromNow(13), maxParticipants: 20,  group: sustainGroup._id, manager: by['annawhite']._id },
    { title: 'Community Compost Workshop',     category: 'Sustainability',    description: 'Set up your first home compost bin and learn what to do (and not do) with your food waste.',          address: 'Portland Farmers Market, Portland, OR',    date: daysFromNow(27), maxParticipants: 30,  group: sustainGroup._id, manager: by['annawhite']._id },
    { title: 'Repair Cafe — Fix Don\'t Trash', category: 'Sustainability',    description: 'Bring broken electronics, clothing, or bikes. Skilled volunteers help you fix them for free.',        address: 'Woodstock Community Center, Portland, OR', date: daysFromNow(48), maxParticipants: 50,  group: sustainGroup._id, manager: by['annawhite']._id },
    // Senior Care Network
    { title: 'Senior Tech Help Day',           category: 'Healthcare',        description: 'Help seniors set up smartphones, video calls, and online banking. Patience required, no expertise.',  address: '6300 Wilshire Blvd, Los Angeles, CA',       date: daysFromNow(8),  maxParticipants: 30,  group: seniorGroup._id,  manager: by['carlosrivera']._id },
    { title: 'Grocery Run Volunteer Sign-Up',  category: 'Healthcare',        description: 'Weekly grocery runs for homebound seniors. Volunteer for one or multiple Saturdays.',                address: 'Senior Care HQ, Los Angeles, CA',          date: daysFromNow(15), maxParticipants: 40,  group: seniorGroup._id,  manager: by['carlosrivera']._id },
    { title: 'Holiday Companion Visits',       category: 'Healthcare',        description: 'Visit a senior resident at a local care facility during the holiday season. A little company goes far.', address: 'Brentwood Care Center, Los Angeles, CA',  date: daysFromNow(42), maxParticipants: 30,  group: seniorGroup._id,  manager: by['carlosrivera']._id },
    // Tech for Good
    { title: 'Nonprofit Website Sprint',       category: 'Technology',        description: 'Weekend hackathon building websites for 3 local nonprofits. All skill levels from design to dev.',    address: '701 Brazos St, Austin, TX',                 date: daysFromNow(17), maxParticipants: 40,  group: techGroup._id,    manager: by['mayapatel']._id },
    { title: 'Digital Literacy for Seniors',   category: 'Technology',        description: 'Teach email, video calling, and safe browsing to seniors in a relaxed, judgment-free setting.',       address: 'Austin Public Library, Austin, TX',         date: daysFromNow(29), maxParticipants: 20,  group: techGroup._id,    manager: by['mayapatel']._id },
    { title: 'Open Source Contribution Day',   category: 'Technology',        description: 'Contribute to open source tools used by humanitarian organizations. All languages welcome.',           address: 'Capital Factory, Austin, TX',               date: daysFromNow(44), maxParticipants: 35,  group: techGroup._id,    manager: by['mayapatel']._id },
    // Neighborhood Watch Alliance
    { title: 'Emergency Preparedness Fair',    category: 'Community Safety',  description: 'Learn first aid, disaster prep, and how to create a family emergency plan. Free resources provided.',  address: '1 Centre St, New York, NY',                 date: daysFromNow(20), maxParticipants: 100, group: watchGroup._id,   manager: by['admin']._id },
    { title: 'Community Safety Walk',          category: 'Community Safety',  description: 'Join city officials and neighbors for a safety assessment walk through the local streets.',            address: 'City Hall, New York, NY',                   date: daysFromNow(9),  maxParticipants: 50,  group: watchGroup._id,   manager: by['admin']._id },
    { title: 'Self-Defense Workshop',          category: 'Community Safety',  description: 'Free introductory self-defense class open to all genders and ages. Taught by certified instructors.', address: 'YMCA Midtown, New York, NY',                date: daysFromNow(37), maxParticipants: 40,  group: watchGroup._id,   manager: by['admin']._id },
  ];

  const geocodedEvents = await geocodeEvents(eventsData);
  await Event.insertMany(geocodedEvents);
  console.log(`Created ${geocodedEvents.length} events.`);

  const img = {
    green:  saveImage(76,  175, 80),
    blue:   saveImage(33,  150, 243),
    orange: saveImage(255, 152, 0),
    purple: saveImage(156, 39,  176),
    red:    saveImage(244, 67,  54),
    teal:   saveImage(0,   188, 212),
    yellow: saveImage(255, 235, 59),
  };

  const postsData = [
    // Green City Initiative
    { author: by['sarahjones']._id,   group: greenGroup._id,   postType: 'text',  content: 'Excited to announce our Central Park Clean-Up Day next week! Last month we collected over 200 lbs of trash. Let us beat that record. See you all there!' },
    { author: by['tomwilson']._id,    group: greenGroup._id,   postType: 'image', imageUrl: img.green,  content: 'Just got back from the riverside planting session. We put 15 saplings in the ground today. In 10 years this stretch will be completely shaded.' },
    { author: by['annawhite']._id,    group: greenGroup._id,   postType: 'text',  content: 'Reminder: bring reusable water bottles to Saturday\'s event. We are going completely zero-waste this time!' },
    { author: by['sarahjones']._id,   group: greenGroup._id,   postType: 'image', imageUrl: img.green,  content: 'Thank you to everyone who joined last weekend\'s clean-up! The park looks incredible. Here is a shot from the end of the day.' },
    // Youth Education Hub
    { author: by['mikechen']._id,     group: eduGroup._id,     postType: 'text',  content: 'We are looking for 5 more math tutors for middle school students. If you have a STEM background please reach out — this is incredibly rewarding work.' },
    { author: by['jamestaylor']._id,  group: eduGroup._id,     postType: 'text',  content: 'Had an amazing session today — a student went from failing algebra to acing her first quiz in 3 weeks. This is why we do what we do.' },
    { author: by['lisagarcia']._id,   group: eduGroup._id,     postType: 'image', imageUrl: img.yellow, content: 'Check out the artwork the kids made during our creativity workshop last Saturday. Absolutely brilliant!' },
    { author: by['mayapatel']._id,    group: eduGroup._id,     postType: 'text',  content: 'We partnered with two new schools this month, adding 60 more students to our tutoring program. Huge milestone for us!' },
    // Community Kitchen
    { author: by['emilypark']._id,    group: kitchenGroup._id, postType: 'text',  content: 'We served 450 meals last Saturday — a new record for our group! Huge thanks to every single volunteer who showed up.' },
    { author: by['annawhite']._id,    group: kitchenGroup._id, postType: 'image', imageUrl: img.orange, content: 'This week\'s menu preview: vegetable curry and lentil soup. Come hungry — volunteers eat too!' },
    { author: by['rachelbrown']._id,  group: kitchenGroup._id, postType: 'text',  content: 'Does anyone have connections with local farms? We are looking for fresh produce donations ahead of the holiday feast.' },
    { author: by['emilypark']._id,    group: kitchenGroup._id, postType: 'image', imageUrl: img.red,    content: 'A glimpse of our incredible kitchen team in action during last week\'s prep session. So much love in that room.' },
    // Paws & Claws Rescue
    { author: by['rachelbrown']._id,  group: pawsGroup._id,    postType: 'image', imageUrl: img.blue,   content: 'Meet Biscuit! This 2-year-old golden mix has been with us 3 weeks and is ready for a forever home. Great with kids and other dogs.' },
    { author: by['sarahjones']._id,   group: pawsGroup._id,    postType: 'text',  content: 'Our last adoption event at Faneuil Hall was a huge success — 12 animals found homes! Thank you to every volunteer who made it happen.' },
    { author: by['lisagarcia']._id,   group: pawsGroup._id,    postType: 'text',  content: 'We currently have 8 cats in foster care looking for homes. If you\'re considering adoption, reach out to us directly.' },
    { author: by['rachelbrown']._id,  group: pawsGroup._id,    postType: 'image', imageUrl: img.purple, content: 'Our foster families are truly heroes. Look at these tiny kittens — they came in last night and are already thriving!' },
    // City Health Runners
    { author: by['davidkim']._id,     group: runnersGroup._id, postType: 'text',  content: 'Registration is open for our 5K Charity Run! Last year we raised $8,000 for local free clinics. Let us top that this year.' },
    { author: by['jamestaylor']._id,  group: runnersGroup._id, postType: 'image', imageUrl: img.teal,   content: 'Great turnout at Sunday\'s morning yoga session in the park. About 40 people showed up — what a way to start the week.' },
    { author: by['davidkim']._id,     group: runnersGroup._id, postType: 'text',  content: 'Reminder: bring a reusable water bottle and sunscreen to Saturday\'s trail cleanup run. It is going to be a warm one!' },
    // Arts for All
    { author: by['lisagarcia']._id,   group: artsGroup._id,    postType: 'image', imageUrl: img.purple, content: 'The Wynwood mural is 40% done! Come see the progress and add your brush strokes this Saturday. All skill levels welcome.' },
    { author: by['annawhite']._id,    group: artsGroup._id,    postType: 'text',  content: 'We just got a grant to run 10 free art workshops at schools in underserved neighborhoods this semester. So exciting!' },
    { author: by['carlosrivera']._id, group: artsGroup._id,    postType: 'image', imageUrl: img.yellow, content: 'Kids from yesterday\'s workshop showing off their finished paintings. Absolutely stunning work from these young artists.' },
    // Trail Blazers Hiking Club
    { author: by['tomwilson']._id,    group: hikingGroup._id,  postType: 'image', imageUrl: img.green,  content: 'Views from last weekend\'s Tiger Mountain trail maintenance day. We cleared 2 miles of overgrown path. Worth every step.' },
    { author: by['davidkim']._id,     group: hikingGroup._id,  postType: 'text',  content: 'Spots for the Mt. Rainier day hike are filling fast — only 6 left! Sign up on the events page before they are gone.' },
    { author: by['tomwilson']._id,    group: hikingGroup._id,  postType: 'text',  content: 'First-time hikers: our Discovery Park walk next month is a perfect starting point. Flat, beautiful, and totally beginner-friendly.' },
    // Sports for Good
    { author: by['jamestaylor']._id,  group: sportsGroup._id,  postType: 'text',  content: 'Our youth basketball clinic last month had 45 kids! We need 10 more volunteer coaches for the spring season. Experience preferred but not required.' },
    { author: by['davidkim']._id,     group: sportsGroup._id,  postType: 'image', imageUrl: img.orange, content: 'The community soccer tournament was an absolute blast. 16 teams, zero drama, 100% good vibes. See you at the next one!' },
    { author: by['jamestaylor']._id,  group: sportsGroup._id,  postType: 'text',  content: 'We just distributed 200 pairs of cleats and 50 basketballs to 8 local schools. Huge thanks to everyone who donated.' },
    // Sustainable Living Co-op
    { author: by['annawhite']._id,    group: sustainGroup._id, postType: 'text',  content: 'Tip of the week: freeze vegetable scraps for broth instead of tossing them. You would be amazed what ends up in the bin that should not.' },
    { author: by['mayapatel']._id,    group: sustainGroup._id, postType: 'image', imageUrl: img.teal,   content: 'Our community compost bin has diverted over 400 lbs of food waste from landfill this month alone. That is real impact!' },
    { author: by['annawhite']._id,    group: sustainGroup._id, postType: 'text',  content: 'The Repair Cafe is back next month. Bring your broken stuff — we have volunteers who can fix electronics, bikes, clothing, and more.' },
    // Senior Care Network
    { author: by['carlosrivera']._id, group: seniorGroup._id,  postType: 'text',  content: 'A reminder that our grocery run program needs 5 more volunteers for the November schedule. Even one Saturday a month makes a huge difference.' },
    { author: by['lisagarcia']._id,   group: seniorGroup._id,  postType: 'image', imageUrl: img.blue,   content: 'Yesterday\'s senior tech help session was so heartwarming. One participant sent her first video call to her grandkids in another country.' },
    { author: by['carlosrivera']._id, group: seniorGroup._id,  postType: 'text',  content: 'We are looking for volunteers to visit senior care facilities during the holiday season. An hour of your time means everything to them.' },
    // Tech for Good
    { author: by['mayapatel']._id,    group: techGroup._id,    postType: 'text',  content: 'We built and launched 3 websites for local nonprofits at last weekend\'s sprint. 18 volunteers, 48 hours, 3 organizations that now have a web presence.' },
    { author: by['mikechen']._id,     group: techGroup._id,    postType: 'image', imageUrl: img.teal,   content: 'Photos from the digital literacy session. These participants came in not knowing how to send an email and left ready to video call family.' },
    { author: by['mayapatel']._id,    group: techGroup._id,    postType: 'text',  content: 'Open Source Contribution Day is confirmed for next month. We are targeting tools used by humanitarian orgs — come help make a real difference with code.' },
    // Neighborhood Watch Alliance
    { author: by['admin']._id,         group: watchGroup._id,   postType: 'text',  content: 'Our Emergency Preparedness Fair is coming up. We will cover first aid, evacuation plans, and disaster kits. Free for all residents.' },
    { author: by['carlosrivera']._id, group: watchGroup._id,   postType: 'image', imageUrl: img.red,    content: 'Great turnout at this month\'s Community Safety Walk. City officials, residents, and volunteers all working together.' },
    { author: by['admin']._id,         group: watchGroup._id,   postType: 'text',  content: 'Reminder: if you see something, say something. The non-emergency tip line is always open. Stay safe, look out for each other.' },
  ];

  await Post.insertMany(postsData);
  const imageCount = postsData.filter(p => p.postType === 'image').length;
  console.log(`Created ${postsData.length} posts (${imageCount} with images, ${postsData.length - imageCount} text).`);

  console.log('\nSeed complete! All accounts use password: "password"');
  console.log('Users:', users.map(u => u.username).join(', '));

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
