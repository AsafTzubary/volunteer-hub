const express = require('express');
const { requireAuth } = require('../../middlewares/auth');

const { listGroupPosts, createPost, updatePost, getFeed, deletePost } = require('../../controllers/posts.controller');

const router = express.Router();

router.get('/feed', requireAuth, getFeed);
router.get('/', requireAuth, listGroupPosts);
router.post('/', requireAuth, createPost);
router.put('/:id', requireAuth, updatePost);
router.delete('/:id', requireAuth, deletePost);

module.exports = router;
