const Group = require('../models/Group');

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

module.exports = { membersByCategory, getCategories };
