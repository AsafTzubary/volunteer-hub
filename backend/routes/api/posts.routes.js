const express = require('express');
const { requireAuth } = require('../../middlewares/auth');

const {
  listGroupPosts,
  createPost,
  getFeed,
  deletePost,
  toggleLike,
  listComments,
  addComment,
  deleteComment,
} = require('../../controllers/posts.controller');

const router = express.Router();

router.get('/feed', requireAuth, getFeed);
router.get('/', requireAuth, listGroupPosts);
router.post('/', requireAuth, createPost);
router.delete('/:id', requireAuth, deletePost);
router.post('/:id/like', requireAuth, toggleLike);
router.get('/:id/comments', requireAuth, listComments);
router.post('/:id/comments', requireAuth, addComment);
router.delete('/:id/comments/:commentId', requireAuth, deleteComment);

module.exports = router;
