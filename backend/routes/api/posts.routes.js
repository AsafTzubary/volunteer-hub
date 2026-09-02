const express = require('express');
const { asyncHandler } = require('../../middlewares/asyncHandler');
const { requireAuth } = require('../../middlewares/auth');

const {
  listGroupPosts,
  createPost,
  updatePost,
  getFeed,
  deletePost,
  toggleLike,
  listComments,
  addComment,
  deleteComment,
} = require('../../controllers/posts.controller');

const router = express.Router();

router.get('/feed', requireAuth, asyncHandler(getFeed));
router.get('/', requireAuth, asyncHandler(listGroupPosts));
router.post('/', requireAuth, asyncHandler(createPost));
router.put('/:id', requireAuth, asyncHandler(updatePost));
router.delete('/:id', requireAuth, asyncHandler(deletePost));
router.post('/:id/like', requireAuth, asyncHandler(toggleLike));
router.get('/:id/comments', requireAuth, asyncHandler(listComments));
router.post('/:id/comments', requireAuth, asyncHandler(addComment));
router.delete('/:id/comments/:commentId', requireAuth, asyncHandler(deleteComment));

module.exports = router;
