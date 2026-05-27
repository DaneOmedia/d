const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  const teamPassword = process.env.TEAM_PASSWORD || 'optionlogin';

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  if (password !== teamPassword) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  res.json({ success: true, token: Buffer.from(`auth:${Date.now()}`).toString('base64') });
});

module.exports = router;
