import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  Alert, FlatList, RefreshControl, KeyboardAvoidingView, Platform,
  ImageBackground, StatusBar
} from 'react-native';

const CRITERIA = {
  Film: ['Scénario', 'Réalisation', 'Acteurs'],
  Resto: ['Qualité Plats', 'Service', 'Ambiance'],
  Voyage: ['Paysage', 'Activités', 'Coût'],
  Musique: ['Mélodie', 'Paroles', 'Voix']
};

export default function HomeScreen() {
  // 📍 METS TON IP ICI (ex: 192.168.1.XX)
  const API_URL = 'http://192.168.1.159:3000';

  const [currentUser, setCurrentUser] = useState(null);
  const [pseudoInput, setPseudoInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [view, setView] = useState('feed'); // 'feed' ou 'profile'
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Film');
  const [universalScore, setUniversalScore] = useState(0); 
  const [technicalScores, setTechnicalScores] = useState({});
  const [feed, setFeed] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

// --- CONNEXION ---
  const handleLogin = async () => {
    setLoginError('');
    if (!pseudoInput.trim() || !passwordInput.trim()) {
      setLoginError('Il faut un pseudo ET un mot de passe.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: pseudoInput.trim(), password: passwordInput.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        setLoginError('');
        setCurrentUser(data);
        fetchExperiences();
      } else {
        setLoginError('Mauvais mot de passe.');
      }
    } catch (error) {
      setLoginError('Impossible de joindre le serveur.');
    }
  };

  // --- CHARGEMENT DU FEED ---
  const fetchExperiences = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${API_URL}/experiences`);
      const data = await response.json();
      setFeed(data);
    } catch (error) {
      console.log("Erreur chargement:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // --- PUBLICATION ---
  const handleSubmit = async () => {
    if (!title || universalScore === 0) {
      Alert.alert("Oups", "Il manque le titre ou ton ressenti !");
      return;
    }

    const experienceData = {
      user_id: currentUser.id,
      category,
      title,
      universal_score: universalScore,
      technical_ratings: technicalScores
    };

    try {
      const res = await fetch(`${API_URL}/experience`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(experienceData),
      });
      
      if (res.ok) {
        setTitle(''); 
        setUniversalScore(0); 
        setTechnicalScores({});
        fetchExperiences(); 
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible de publier.");
    }
  };

  const handleDelete = async (id) => {
    Alert.alert(
      "Supprimer",
      "Es-tu sûr de vouloir effacer cette note ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer", 
          style: "destructive", 
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/experience/${id}`, { method: 'DELETE' });
              if (res.ok) fetchExperiences(); // On rafraîchit la liste
            } catch (error) {
              Alert.alert("Erreur", "Connexion serveur impossible");
            }
          } 
        }
      ]
    );
  };

  const updateTechnicalScore = (criterion, rating) => {
    setTechnicalScores(prev => ({ ...prev, [criterion]: rating }));
  };

// --- RENDU D'UNE CARTE ---
  const renderItem = ({ item }) => {
    // 1. On transforme technical_ratings (texte dans SQLite) en objet JSON exploitable
    const ratings = typeof item.technical_ratings === 'string' 
      ? JSON.parse(item.technical_ratings) 
      : (item.technical_ratings || {});

    return (
      <View style={styles.card}>
        {/* EN-TÊTE DE LA CARTE */}
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardCategory}>{item.category}</Text>
            <Text style={styles.cardAuthor}>Par {item.pseudo || 'Anonyme'}</Text>
          </View>

          {/* BOUTON SUPPRIMER : Visible uniquement si c'est MA note */}
          {item.user_id === currentUser?.id && (
            <TouchableOpacity 
              onPress={() => handleDelete(item.id)}
              style={styles.deleteBtn}
            >
              <Text style={styles.deleteBtnText}>Effacer 🗑️</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* CONTENU DE LA CARTE */}
        <Text style={styles.cardTitle}>{item.title}</Text>
        
        {/* ÉTOILES GLOBALES */}
        <Text style={styles.stars}>
          {'★'.repeat(item.universal_score)}{'☆'.repeat(5 - item.universal_score)}
        </Text>
        
        {/* GRILLE DES CRITÈRES TECHNIQUES */}
        <View style={styles.techGrid}>
          {Object.entries(ratings).map(([key, val]) => (
            <View key={key} style={styles.techBadge}>
              <Text style={styles.techText}>{key}: {val}/5</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // --- VUE PROFIL ---
  const renderProfile = () => {
    // On filtre pour n'afficher que les notes d'Ismael/Samir
    const myExperiences = feed.filter(item => item.user_id === currentUser.id);

    return (
      <View style={styles.profileContainer}>
        {/* CARTE D'IDENTITÉ */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>
              {currentUser.pseudo ? currentUser.pseudo[0].toUpperCase() : 'U'}
            </Text>
          </View>
          <Text style={styles.profileName}>{currentUser.pseudo}</Text>
          <Text style={styles.profileStats}>{myExperiences.length} expériences partagées</Text>
        </View>

        <Text style={styles.sectionTitle}>Mon Journal de Bord</Text>
        
        <FlatList
          data={myExperiences}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem} // On réutilise le design des cartes !
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>
              Tu n'as pas encore publié de note.
            </Text>
          }
        />
        
        {/* BOUTON DÉCONNEXION */}
        <TouchableOpacity 
          style={styles.logoutBtn} 
          onPress={() => setCurrentUser(null)}
        >
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ÉCRAN DE CONNEXION
  if (!currentUser) {
    return (
      <View style={styles.loginWrapper}>
        <StatusBar barStyle="light-content" />
        <ImageBackground
          source={require('../../assets/images/login-bg-2.jpg')}
          style={styles.loginBg}
          resizeMode="cover"
        >
          <View style={styles.loginOverlay}>
            <View style={styles.loginCard}>
              <Text style={styles.loginTitle}>Experiences</Text>

              <View style={styles.loginForm}>
                <TextInput
                  style={styles.loginInput}
                  placeholder="Ton pseudo..."
                  placeholderTextColor="#999"
                  value={pseudoInput}
                  onChangeText={(t) => { setPseudoInput(t); setLoginError(''); }}
                  onSubmitEditing={handleLogin}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.loginInput}
                  placeholder="Mot de passe..."
                  placeholderTextColor="#999"
                  value={passwordInput}
                  onChangeText={(t) => { setPasswordInput(t); setLoginError(''); }}
                  secureTextEntry={true}
                  onSubmitEditing={handleLogin}
                />

                {loginError ? (
                  <Text style={styles.loginError}>{loginError}</Text>
                ) : null}

                <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
                  <Text style={styles.loginBtnText}>Se connecter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ImageBackground>
      </View>
    );
  }

  // ÉCRAN PRINCIPAL
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      {/* --- NOUVEAU HEADER DE NAVIGATION --- */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setView('feed')}>
          <Text style={[styles.headerNav, view === 'feed' && styles.headerActive]}>Flux</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setView('profile')}>
          <Text style={[styles.headerNav, view === 'profile' && styles.headerActive]}>Mon Profil</Text>
        </TouchableOpacity>
      </View>

      {/* --- AFFICHAGE CONDITIONNEL --- */}
      {view === 'feed' ? (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchExperiences} />}
          ListHeaderComponent={
            <View style={styles.formContainer}>
              <Text style={styles.welcomeText}>Salut, {currentUser.pseudo} 👋</Text>
              
              <View style={styles.categoryRow}>
                {Object.keys(CRITERIA).map((cat) => (
                  <TouchableOpacity 
                    key={cat} 
                    onPress={() => { setCategory(cat); setTechnicalScores({}); }} 
                    style={[styles.catBtn, category === cat && styles.catBtnActive]}
                  >
                    <Text style={[styles.catTxt, category === cat && styles.catTxtActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput 
                style={styles.input} 
                placeholder="Titre de l'expérience..." 
                value={title} 
                onChangeText={setTitle} 
              />

              <Text style={styles.ressentLabel}>Mon ressenti</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setUniversalScore(s)}>
                    <Text style={styles.bigStar}>{s <= universalScore ? '★' : '☆'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {CRITERIA[category].map((crit) => (
                <View key={crit} style={styles.techRow}>
                  <Text style={styles.techLabel}>{crit}</Text>
                  <View style={{flexDirection:'row'}}>
                    {[1,2,3,4,5].map(s => (
                      <TouchableOpacity key={s} onPress={() => updateTechnicalScore(crit, s)}>
                        <Text style={styles.smallPoint}>{s <= (technicalScores[crit] || 0) ? '●' : '○'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.postBtn} onPress={handleSubmit}>
                <Text style={styles.postBtnText}>Publier la note</Text>
              </TouchableOpacity>
              
              <Text style={styles.feedTitle}>Dernières pépites</Text>
            </View>
          }
        />
      ) : (
    renderProfile() 
  )}
</KeyboardAvoidingView>
);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', paddingTop: 60 },
  header: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  formContainer: { padding: 20, backgroundColor: '#fff', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 5 },
  categoryRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15 },
  catBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#eee', marginHorizontal: 5 },
  catBtnActive: { backgroundColor: '#007AFF' },
  catTxtActive: { color: '#fff', fontWeight: 'bold' },
  input: { borderBottomWidth: 1, borderColor: '#ddd', padding: 10, fontSize: 18, marginBottom: 15 },
  ressentLabel: { fontSize: 13, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15 },
  bigStar: { fontSize: 40, color: '#FFD700', marginHorizontal: 5 },
  techRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  techLabel: { fontSize: 14, color: '#666' },
  smallPoint: { fontSize: 22, color: '#007AFF', marginHorizontal: 3 },
  postBtn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  postBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  feedTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 30, marginBottom: 10 },
  
  // Cartes du Feed
  card: { backgroundColor: '#fff', padding: 20, marginHorizontal: 20, marginBottom: 15, borderRadius: 20, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'flex-start' },
  cardCategory: { fontSize: 12, color: '#007AFF', fontWeight: 'bold', textTransform: 'uppercase' },
  cardAuthor: { fontSize: 12, color: '#999', fontWeight: '600' },
  cardTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  stars: { fontSize: 20, color: '#FFD700', marginBottom: 10 },
  techGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  techBadge: { backgroundColor: '#f0f0f5', padding: 6, borderRadius: 8, marginRight: 8, marginBottom: 8 },
  techText: { fontSize: 11, color: '#555' },
  deleteBtn: { backgroundColor: '#FFE5E5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  deleteBtnText: { color: '#FF3B30', fontWeight: 'bold', fontSize: 11 },

  // Connexion
  loginWrapper: {
    flex: 1,
    ...(Platform.OS === 'web' ? { height: '100vh' as any } : {}),
  },
  loginBg: {
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'web' ? { minHeight: '100vh' as any } : {}),
  },
  loginOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginCard: {
    width: '100%',
    maxWidth: 420,
  },
  loginTitle: {
    fontSize: 54,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 48,
    letterSpacing: -1,
  },
  loginForm: { gap: 14 },
  loginInput: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111',
  },
  loginError: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  loginBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  loginBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },

  // --- AJOUTS POUR LA NAVIGATION ---
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee',
    paddingBottom: 5 
  },
  headerNav: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#999', 
    paddingVertical: 10 
  },
  headerActive: { 
    color: '#007AFF', 
    borderBottomWidth: 3, 
    borderBottomColor: '#007AFF' 
  },
  welcomeText: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    textAlign: 'center' 
  },

  // --- AJOUTS POUR LE PROFIL ---
  profileContainer: { flex: 1, padding: 10 },
  profileCard: { 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 25, 
    borderRadius: 25, 
    margin: 10, 
    elevation: 4 
  },
  avatarLarge: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    backgroundColor: '#007AFF', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  profileName: { fontSize: 22, fontWeight: 'bold' },
  profileStats: { color: '#666', marginTop: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 15, marginLeft: 20 },
  logoutBtn: { marginTop: 10, padding: 15, alignItems: 'center' },
  logoutText: { color: '#FF3B30', fontWeight: 'bold' },
});