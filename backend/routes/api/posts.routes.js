const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { listGroupPosts, createPost, deletePost } = require('../../controllers/posts.controller');

const router = express.Router();

router.get('/', requireAuth, listGroupPosts);
router.post('/', requireAuth, createPost);
router.delete('/:id', requireAuth, deletePost);

module.exports = router;
