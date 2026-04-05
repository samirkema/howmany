const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // On utilise uniquement pg maintenant

const app = express();
app.use(cors());
app.use(express.json());

// --- CONNEXION SUPABASE ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Sambal01$20242025@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

// Test de connexion immédiat
pool.connect((err) => {
  if (err) console.error("❌ Erreur de connexion Supabase:", err.stack);
  else console.log("✅ Connecté à Supabase (PostgreSQL)");
});

// --- ROUTES ---

// 1. Route de TEST
app.get('/', (req, res) => {
  res.send("Le serveur Genius Venture est en ligne sur Supabase !");
});

// 2. Route LOGIN (Adaptée PostgreSQL)
app.post('/login', async (req, res) => {
  const { pseudo, password } = req.body;
  try {
    const userRes = await pool.query("SELECT * FROM users WHERE pseudo = $1", [pseudo]);
    const user = userRes.rows[0];

    if (user) {
      if (user.password === password) {
        console.log(`✅ Connexion réussie : ${pseudo}`);
        res.json(user);
      } else {
        res.status(401).json({ error: "Mot de passe incorrect" });
      }
    } else {
      // Création automatique si n'existe pas
      const newUser = await pool.query(
        "INSERT INTO users (pseudo, password) VALUES ($1, $2) RETURNING *",
        [pseudo, password]
      );
      console.log(`🆕 Nouvel utilisateur créé : ${pseudo}`);
      res.json(newUser.rows[0]);
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 3. Route RÉCUPÉRER
app.get('/experiences', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// 4. Route PUBLIER
app.post('/experience', async (req, res) => {
  const { user_id, category, title, universal_score, technical_ratings } = req.body;
  const sql = `INSERT INTO experiences (user_id, category, title, universal_score, technical_ratings) VALUES ($1, $2, $3, $4, $5) RETURNING id`;
  
  try {
    const result = await pool.query(sql, [user_id, category, title, universal_score, JSON.stringify(technical_ratings)]);
    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Route SUPPRIMER
app.delete('/experience/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM experiences WHERE id = $1", [id]);
    res.json({ message: "Supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// Port dynamique pour Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur prêt sur le port ${PORT}`);
});
