const Group = require('../models/Group');
const Event = require('../models/Event');
const User = require('../models/User');

async function membersByCategory(req, res) {
  const data = await Group.aggregate([
    { $group: { _id: '$category', memberCount: { $sum: { $size: '$members' } } } },
    { $sort: { memberCount: -1 } },
  ]);
  res.json(data.map(d => ({ category: d._id, memberCount: d.memberCount })));
}

async function getCategories(req, res) {
  const categories = await Group.distinct('category');
  res.json(categories.sort());
}

async function registrationsByMonth(req, res) {
  const match = {};
  if (req.query.from || req.query.to) {
    match.date = {};
    if (req.query.from) match.date.$gte = new Date(req.query.from + '-01');
    if (req.query.to) {
      const [year, month] = req.query.to.split('-').map(Number);
      match.date.$lte = new Date(year, month, 0);
    }
  }

  const pipeline = [
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $unwind: '$rsvps' },
    { $match: { 'rsvps.status': 'going' } },
    { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ];

  const data = await Event.aggregate(pipeline);
  res.json(data.map(d => ({ year: d._id.year, month: d._id.month, count: d.count })));
}

async function counts(req, res) {
  const users = await User.countDocuments();
  res.json({ users });
}

module.exports = { membersByCategory, getCategories, registrationsByMonth, counts };
