const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { listGroupPosts, createPost } = require('../../controllers/posts.controller');

const router = express.Router();

router.get('/', requireAuth, listGroupPosts);
router.post('/', requireAuth, createPost);

module.exports = router;
