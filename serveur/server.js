const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONNEXION SUPABASE ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Sambal01$20242025@db.vhbpufbtrcihugwtfipn.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

// Test de connexion
pool.connect((err) => {
  if (err) console.error("❌ Erreur de connexion Supabase:", err.stack);
  else console.log("✅ Connecté à Supabase (PostgreSQL)");
});

// --- ROUTES ---

// 1. Route de TEST
const bcrypt = require('bcrypt'); // 1. Importer bcrypt
const saltRounds = 10; // Puissance du hachage

app.post('/login', async (req, res) => {
  const { pseudo, password } = req.body;

  try {
    // 2. Chercher l'utilisateur par son pseudo
    const userRes = await pool.query("SELECT * FROM users WHERE pseudo = $1", [pseudo]);
    const user = userRes.rows[0];

    if (user) {
      // --- CAS : L'UTILISATEUR EXISTE ---
      // 3. On compare le mot de passe tapé avec le HASH stocké en base
      const match = await bcrypt.compare(password, user.password);

      if (match) {
        res.json(user); // Succès
      } else {
        res.status(401).json({ error: "Mot de passe incorrect" });
      }
    } else {
      // --- CAS : NOUVEL UTILISATEUR ---
      // 4. On HACHE le mot de passe avant de l'enregistrer
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const newUser = await pool.query(
        "INSERT INTO users (pseudo, password) VALUES ($1, $2) RETURNING *",
        [pseudo, hashedPassword] // On stocke hashedPassword, PAS password !
      );
      res.json(newUser.rows[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de l'authentification" });
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
    console.error("Erreur recup:", err);
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur prêt sur le port ${PORT}`);
});
