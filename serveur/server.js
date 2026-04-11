const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const saltRounds = 10;

// --- CONNEXION SUPABASE ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Sambal01$20242025@db.vhbpufbtrcihugwtfipn.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect((err) => {
  if (err) console.error("❌ Erreur de connexion Supabase:", err.stack);
  else console.log("✅ Connecté à Supabase (PostgreSQL)");
});

// ==========================================
// 🛡️ FONCTION MIDDLEWARE (LE VIDEUR)
// ==========================================
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // On récupère le token après le mot "Bearer "
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(403).json({ error: "Badge (token) manquant !" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Badge invalide ou expiré" });
    }
    // On stocke l'ID de l'utilisateur dans la requête pour l'utiliser plus tard
    req.userId = decoded.userId;
    next(); // On passe à la suite
  });
};

// --- ROUTES ---

// 1. Route de TEST
app.get('/', (req, res) => {
  res.send("Le serveur Genius Venture est en ligne !");
});

// 2. Route LOGIN (Publique)
app.post('/login', async (req, res) => {
  const { pseudo, password } = req.body;

  try {
    const userRes = await pool.query("SELECT * FROM users WHERE pseudo = $1", [pseudo]);
    const user = userRes.rows[0];

    if (user) {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        const token = jwt.sign(
          { userId: user.id }, 
          process.env.JWT_SECRET, 
          { expiresIn: '7d' }
        );
        res.json({ user, token });
      } else {
        res.status(401).json({ error: "Mot de passe incorrect" });
      }
    } else {
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const newUserRes = await pool.query(
        "INSERT INTO users (pseudo, password) VALUES ($1, $2) RETURNING *",
        [pseudo, hashedPassword]
      );
      const newUser = newUserRes.rows[0];
      
      const token = jwt.sign(
        { userId: newUser.id }, 
        process.env.JWT_SECRET, 
        { expiresIn: '7d' }
      );
      res.json({ user: newUser, token });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de l'authentification" });
  }
});

// 3. Route RÉCUPÉRER (Protégée)
app.get('/experiences', verifyToken, async (req, res) => {
  const sql = `
    SELECT experiences.*, users.pseudo 
    FROM experiences 
    LEFT JOIN users ON experiences.user_id = users.id 
    ORDER BY experiences.id DESC`;
  try {
    const result = await pool.query(sql);
    const cleanData = result.rows.map(row => ({
      ...row,
      technical_ratings: typeof row.technical_ratings === 'string' 
        ? JSON.parse(row.technical_ratings) 
        : row.technical_ratings
    }));
    res.json(cleanData);
  } catch (err) {
    console.error("Erreur recup:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Route PUBLIER (Protégée)
app.post('/experience', verifyToken, async (req, res) => {
  const { category, title, universal_score, technical_ratings } = req.body;
  // Utilisation de req.userId provenant du token plutôt que user_id envoyé par le body
  const sql = `INSERT INTO experiences (user_id, category, title, universal_score, technical_ratings) VALUES ($1, $2, $3, $4, $5) RETURNING id`;
  try {
    const result = await pool.query(sql, [req.userId, category, title, universal_score, JSON.stringify(technical_ratings)]);
    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Route SUPPRIMER (Protégée)
app.delete('/experience/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Optionnel : vérifier ici si req.userId est bien le propriétaire de l'experience id
    await pool.query("DELETE FROM experiences WHERE id = $1", [id]);
    res.json({ message: "Supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur prêt et sécurisé sur le port ${PORT}`);
});