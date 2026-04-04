const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

// Connexion à la base de données
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) console.error("Erreur de connexion :", err.message);
  else console.log("Connecté à la base de données SQLite.");
});

// --- PARTIE INITIALISATION (CRUCIALE) ---
db.serialize(() => {
  console.log("Vérification des tables...");

  // Création de la table users avec la colonne password
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pseudo TEXT UNIQUE,
    password TEXT
  )`, (err) => {
    if (err) console.error("Erreur table users:", err.message);
    else console.log("Table 'users' prête.");
  });

  // Création de la table experiences
  db.run(`CREATE TABLE IF NOT EXISTS experiences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    category TEXT,
    title TEXT,
    universal_score INTEGER,
    technical_ratings TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`, (err) => {
    if (err) console.error("Erreur table experiences:", err.message);
    else console.log("Table 'experiences' prête.");
  });
});
// --- FIN DE L'INITIALISATION ---

// 1. Route de TEST (Ouvre http://localhost:3000 dans ton navigateur)
app.get('/', (req, res) => {
  res.send("Le serveur est en ligne !");
});

// 2. Route LOGIN
app.post('/login', (req, res) => {
  const { pseudo, password } = req.body;

  // 1. On cherche d'abord si l'utilisateur existe
  db.get("SELECT * FROM users WHERE pseudo = ?", [pseudo], (err, user) => {
    if (err) {
      console.error("Erreur SQL:", err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }

    if (user) {
      // 2. L'utilisateur existe : on compare le mot de passe
      if (user.password === password) {
        console.log(`✅ Connexion réussie : ${pseudo}`);
        res.json(user);
      } else {
        console.log(`❌ Échec : Mauvais mot de passe pour ${pseudo}`);
        res.status(401).json({ error: "Mot de passe incorrect" });
      }
    } else {
      // 3. L'utilisateur n'existe pas : on le crée
      db.run("INSERT INTO users (pseudo, password) VALUES (?, ?)", [pseudo, password], function(err) {
        if (err) {
          console.error("Erreur création:", err.message);
          return res.status(500).json({ error: "Impossible de créer l'utilisateur" });
        }
        console.log(`🆕 Nouvel utilisateur créé : ${pseudo}`);
        res.json({ id: this.lastID, pseudo: pseudo });
      });
    }
  });
});

// 3. Route RÉCUPÉRER (Celle qui te manque !)
app.get('/experiences', (req, res) => {
  // Cette requête dit : "Prends tout de experiences ET le pseudo de la table users"
  const sql = `
    SELECT experiences.*, users.pseudo 
    FROM experiences 
    LEFT JOIN users ON experiences.user_id = users.id 
    ORDER BY experiences.id DESC`;
    
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: err.message });
    }

    // On s'assure que les notes techniques sont bien transformées en objet pour l'app
    const cleanData = rows.map(row => ({
      ...row,
      technical_ratings: typeof row.technical_ratings === 'string' 
        ? JSON.parse(row.technical_ratings) 
        : row.technical_ratings
    }));

    res.json(cleanData);
  });
});

// 4. Route PUBLIER
app.post('/experience', (req, res) => {
  const { user_id, category, title, universal_score, technical_ratings } = req.body;
  console.log("Nouvelle note de l'user :", user_id);
  const sql = `INSERT INTO experiences (user_id, category, title, universal_score, technical_ratings) VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [user_id, category, title, universal_score, JSON.stringify(technical_ratings)], function(err) {
    res.json({ id: this.lastID });
  });
});

app.listen(3000, () => {
  console.log("🚀 Serveur prêt sur http://localhost:3000");
});

// Route pour supprimer une expérience via son ID
app.delete('/experience/:id', (req, res) => {
  const { id } = req.params;
  
  db.run("DELETE FROM experiences WHERE id = ?", [id], function(err) {
    if (err) {
      console.error("Erreur suppression:", err.message);
      return res.status(500).json({ error: "Erreur lors de la suppression" });
    }
    console.log(`🗑️ Note ${id} supprimée`);
    res.json({ message: "Supprimé avec succès" });
  });
});