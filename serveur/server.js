require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// ─── CONNEXION SUPABASE ────────────────────────────────────────────────────
const pool = new Pool({
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.vhbpufbtrcihugwtfipn',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

// ─── INITIALISATION DES TABLES ────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      pseudo TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS experiences (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      category TEXT,
      title TEXT,
      universal_score INTEGER,
      technical_ratings TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS friendships (
      id SERIAL PRIMARY KEY,
      requester_id INTEGER NOT NULL REFERENCES users(id),
      receiver_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(requester_id, receiver_id)
    )
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT
  `);

  console.log('✅ Tables prêtes');
}

initDB().catch(console.error);

// ─── ROUTES ───────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.send('Serveur en ligne !'));

// LOGIN / INSCRIPTION
app.post('/login', async (req, res) => {
  const { pseudo, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE pseudo = $1', [pseudo]);
    if (rows.length > 0) {
      const user = rows[0];
      const isHashed = user.password.startsWith('$2b$') || user.password.startsWith('$2a$');
      const match = isHashed
        ? await bcrypt.compare(password, user.password)
        : user.password === password;
      if (match) {
        res.json(user);
      } else {
        res.status(401).json({ error: 'Mot de passe incorrect' });
      }
    } else {
      const hashed = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO users (pseudo, password) VALUES ($1, $2) RETURNING *',
        [pseudo, hashed]
      );
      res.json(result.rows[0]);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// FEED GLOBAL
app.get('/experiences', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.*, u.pseudo FROM experiences e
      LEFT JOIN users u ON e.user_id = u.id
      ORDER BY e.id DESC
    `);
    res.json(rows.map(r => ({
      ...r,
      technical_ratings: typeof r.technical_ratings === 'string'
        ? JSON.parse(r.technical_ratings) : r.technical_ratings
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// FEED AMIS
app.get('/experiences/friends/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT e.*, u.pseudo FROM experiences e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.user_id IN (
        SELECT CASE WHEN requester_id = $1 THEN receiver_id ELSE requester_id END
        FROM friendships
        WHERE (requester_id = $1 OR receiver_id = $1) AND status = 'accepted'
      )
      ORDER BY e.id DESC
    `, [userId]);
    res.json(rows.map(r => ({
      ...r,
      technical_ratings: typeof r.technical_ratings === 'string'
        ? JSON.parse(r.technical_ratings) : r.technical_ratings
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUBLIER
app.post('/experience', async (req, res) => {
  const { user_id, category, title, universal_score, technical_ratings } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO experiences (user_id, category, title, universal_score, technical_ratings) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [user_id, category, title, universal_score, JSON.stringify(technical_ratings)]
    );
    res.json({ id: result.rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SUPPRIMER
app.delete('/experience/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM experiences WHERE id = $1', [req.params.id]);
    res.json({ message: 'Supprimé' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PROFIL PUBLIC
app.get('/user/:id/profile', async (req, res) => {
  const { id } = req.params;
  const { viewer_id } = req.query;
  try {
    const userRes = await pool.query('SELECT id, pseudo, avatar_url FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Introuvable' });
    const user = userRes.rows[0];

    const statsRes = await pool.query('SELECT COUNT(*) as count FROM experiences WHERE user_id = $1', [id]);
    const count = parseInt(statsRes.rows[0].count);

    if (viewer_id && parseInt(viewer_id) !== parseInt(id)) {
      const fRes = await pool.query(`
        SELECT * FROM friendships
        WHERE (requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1)
      `, [viewer_id, id]);
      let status = 'none';
      if (fRes.rows.length > 0) {
        const f = fRes.rows[0];
        if (f.status === 'accepted') status = 'accepted';
        else if (f.requester_id == viewer_id) status = 'pending_sent';
        else status = 'pending_received';
      }
      res.json({ ...user, experience_count: count, friendship_status: status });
    } else {
      res.json({ ...user, experience_count: count, friendship_status: 'self' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// EXPÉRIENCES D'UN UTILISATEUR
app.get('/user/:id/experiences', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM experiences WHERE user_id = $1 ORDER BY id DESC',
      [req.params.id]
    );
    res.json(rows.map(r => ({
      ...r,
      technical_ratings: typeof r.technical_ratings === 'string'
        ? JSON.parse(r.technical_ratings) : r.technical_ratings
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ENVOYER DEMANDE D'AMI
app.post('/friendship/request', async (req, res) => {
  const { requester_id, receiver_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO friendships (requester_id, receiver_id, status) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [requester_id, receiver_id, 'pending']
    );
    res.json({ message: 'Demande envoyée' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ACCEPTER
app.put('/friendship/accept', async (req, res) => {
  const { requester_id, receiver_id } = req.body;
  try {
    await pool.query(
      "UPDATE friendships SET status = 'accepted' WHERE requester_id = $1 AND receiver_id = $2",
      [requester_id, receiver_id]
    );
    res.json({ message: 'Ami accepté' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// RETIRER AMI
app.delete('/friendship', async (req, res) => {
  const { user_id, other_id } = req.body;
  try {
    await pool.query(
      'DELETE FROM friendships WHERE (requester_id=$1 AND receiver_id=$2) OR (requester_id=$2 AND receiver_id=$1)',
      [user_id, other_id]
    );
    res.json({ message: 'Supprimé' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// LISTE D'AMIS (soi-même uniquement)
app.get('/user/:id/friends', async (req, res) => {
  const { id } = req.params;
  const { viewer_id } = req.query;
  if (!viewer_id || parseInt(viewer_id) !== parseInt(id))
    return res.status(403).json({ error: 'Accès refusé' });
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.pseudo, u.avatar_url,
        (SELECT COUNT(*) FROM experiences WHERE user_id = u.id) as experience_count
      FROM users u
      INNER JOIN friendships f ON (
        (f.requester_id = $1 AND f.receiver_id = u.id) OR
        (f.receiver_id = $1 AND f.requester_id = u.id)
      )
      WHERE f.status = 'accepted'
      ORDER BY u.pseudo
    `, [id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DEMANDES REÇUES
app.get('/user/:id/friend-requests', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.pseudo, f.created_at FROM users u
      INNER JOIN friendships f ON f.requester_id = u.id
      WHERE f.receiver_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// METTRE À JOUR AVATAR
app.put('/user/:id/avatar', async (req, res) => {
  const { avatar_url } = req.body;
  try {
    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatar_url, req.params.id]);
    res.json({ message: 'Avatar mis à jour' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// TOP CATÉGORIES
app.get('/user/:id/top-categories', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT category, COUNT(*) as count FROM experiences
      WHERE user_id = $1 GROUP BY category ORDER BY count DESC LIMIT 3
    `, [req.params.id]);
    res.json(rows.map(r => r.category));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur prêt sur port ${PORT}`));
