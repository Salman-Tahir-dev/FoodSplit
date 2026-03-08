const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticate } = require('../middleware/auth');

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password required' });

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) return res.status(400).json({ error: error.message });

    // Profile is created by trigger, but let's ensure it exists
    if (data.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        name,
        email
      }, { onConflict: 'id' });
    }

    res.json({ user: data.user, session: data.session });
  } catch (err) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });

    // Fetch full user profile
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.json({ user: profile, session: data.session });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    await supabase.auth.signOut();
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const redirectUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL}/auth/reset-password`
      : 'http://localhost:3000/auth/reset-password';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Password reset email sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// POST /api/auth/reset-password — uses recovery access_token from email link
router.post('/reset-password', async (req, res) => {
  const { access_token, new_password } = req.body;
  if (!access_token) return res.status(400).json({ error: 'access_token required' });
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    // Set the session using the recovery token from the email link
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token: access_token // recovery tokens work as both
    });

    if (sessionError) {
      // Try exchangeCodeForSession as fallback
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        sessionData?.user?.id || '',
        { password: new_password }
      );
      if (updateError) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    // Update the password using the established session
    const { error } = await supabase.auth.updateUser({ password: new_password });
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;