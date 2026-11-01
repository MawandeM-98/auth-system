const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

module.exports = router;