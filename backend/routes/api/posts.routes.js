const express = require('express');
const { requireAuth } = require('../../middlewares/auth');

const { listGroupPosts, createPost, getFeed, deletePost } = require('../../controllers/posts.controller');

const router = express.Router();

router.get('/feed', requireAuth, getFeed);
router.get('/', requireAuth, listGroupPosts);
router.post('/', requireAuth, createPost);
router.delete('/:id', requireAuth, deletePost);

module.exports = router;
