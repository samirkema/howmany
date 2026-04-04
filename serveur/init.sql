-- Création de la table des utilisateurs
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des expériences (Le "Guichet Unique" [cite: 89])
CREATE TABLE experiences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    category VARCHAR(50) NOT NULL, -- ex: 'Film', 'Gastronomie' [cite: 83, 84]
    title VARCHAR(255) NOT NULL,
    
    -- "L'Expérience Vécue" (Note principale )
    universal_score INTEGER CHECK (universal_score >= 1 AND universal_score <= 5),
    
    -- Le Barème Technique (Données spécifiques en JSON [cite: 59, 101])
    technical_ratings JSONB, 
    
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);