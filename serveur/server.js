const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const saltRounds = 10;

// --- CONNEXION SUPABASE SÉCURISÉE ---
const pool = new Pool({
  // On utilise UNIQUEMENT la variable d'environnement
  connectionString: process.env.DATABASE_URL, 
  ssl: {
    rejectUnauthorized: false
  }
});

// Test de connexion pour confirmer que Render a bien transmis la clé
pool.connect((err) => {
  if (err) {
    console.error("❌ Erreur : DATABASE_URL est introuvable ou incorrecte sur Render.", err.message);
  } else {
    console.log("✅ Connexion réussie via Variable d'Environnement");
  }
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
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    // 1. On récupère le pseudo pour le RLS
    const userRes = await client.query("SELECT pseudo FROM users WHERE id = $1", [req.userId]);
    const userPseudo = userRes.rows[0].pseudo;
    await client.query(`SET LOCAL app.current_user_pseudo = '${userPseudo}'`);

    // 2. Insertion
    const sql = `INSERT INTO experiences (user_id, category, title, universal_score, technical_ratings) VALUES ($1, $2, $3, $4, $5) RETURNING id`;
    const result = await client.query(sql, [req.userId, category, title, universal_score, JSON.stringify(technical_ratings)]);
    
    await client.query("COMMIT");
    res.json({ id: result.rows[0].id });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


// 5. Route SUPPRIMER (Protégée et synchronisée avec le RLS)
app.delete('/experience/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect(); // On utilise un client pour garder la session locale
  
  try {
    await client.query("BEGIN"); // On ouvre une transaction

    // 1. Récupérer le pseudo via l'ID du Token
    const userRes = await client.query("SELECT pseudo FROM users WHERE id = $1", [req.userId]);
    const userPseudo = userRes.rows[0].pseudo;

    // 2. Transmettre le pseudo à la session Supabase pour débloquer le RLS
    await client.query(`SET LOCAL app.current_user_pseudo = '${userPseudo}'`);

    // 3. Exécuter la suppression
    const deleteRes = await client.query("DELETE FROM experiences WHERE id = $1", [id]);
    
    await client.query("COMMIT");
    res.json({ message: "Supprimé avec succès" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erreur RLS suppression:", err);
    res.status(403).json({ error: "Interdit ou erreur de sécurité" });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur prêt et sécurisé sur le port ${PORT}`);
});