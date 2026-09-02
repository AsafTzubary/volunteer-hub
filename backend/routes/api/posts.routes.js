const express = require('express');
const { asyncHandler } = require('../../middlewares/asyncHandler');
const { requireAuth } = require('../../middlewares/auth');

const { listGroupPosts, createPost, updatePost, getFeed, deletePost } = require('../../controllers/posts.controller');

const router = express.Router();

router.get('/feed', requireAuth, asyncHandler(getFeed));
router.get('/', requireAuth, asyncHandler(listGroupPosts));
router.post('/', requireAuth, asyncHandler(createPost));
router.put('/:id', requireAuth, asyncHandler(updatePost));
router.delete('/:id', requireAuth, asyncHandler(deletePost));

module.exports = router;
