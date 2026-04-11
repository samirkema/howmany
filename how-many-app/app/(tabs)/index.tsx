import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  Alert, FlatList, RefreshControl, KeyboardAvoidingView, Platform 
} from 'react-native';

const CRITERIA = {
  Film: ['Scénario', 'Réalisation', 'Acteurs'],
  Resto: ['Qualité Plats', 'Service', 'Ambiance'],
  Voyage: ['Paysage', 'Activités', 'Coût'],
  Musique: ['Mélodie', 'Paroles', 'Voix']
};

export default function HomeScreen() {
  const API_URL = 'https://howmany.onrender.com';

  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null); // 👈 On stocke le badge ici
  const [pseudoInput, setPseudoInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [view, setView] = useState('feed'); 
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Film');
  const [universalScore, setUniversalScore] = useState(0); 
  const [technicalScores, setTechnicalScores] = useState({});
  const [feed, setFeed] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

// --- CONNEXION (Mise à jour pour JWT) ---
  const handleLogin = async () => {
    if (!pseudoInput.trim() || !passwordInput.trim()) {
      Alert.alert("Oups", "Il faut un pseudo ET un mot de passe !");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pseudo: pseudoInput.trim(), 
          password: passwordInput.trim() 
        })
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentUser(data.user); // Le serveur renvoie { user, token }
        setToken(data.token);      // ✅ On enregistre le badge
        fetchExperiences(data.token); 
      } else {
        Alert.alert("Accès refusé", data.error || "Erreur de connexion");
      }
    } catch (error) {
      Alert.alert("Erreur serveur", "Vérifie ta connexion internet.");
    }
  };

  // --- CHARGEMENT DU FEED (Sécurisé) ---
  const fetchExperiences = async (activeToken) => {
    const tokenToUse = activeToken || token;
    if (!tokenToUse) return;

    setRefreshing(true);
    try {
      const response = await fetch(`${API_URL}/experiences`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${tokenToUse}`, // ✅ Envoi du badge
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (response.ok) setFeed(data);
    } catch (error) {
      console.log("Erreur chargement:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // --- PUBLICATION (Sécurisée) ---
  const handleSubmit = async () => {
    if (!title || universalScore === 0) {
      Alert.alert("Oups", "Il manque le titre ou la note globale !");
      return;
    }

    const experienceData = {
      category,
      title,
      universal_score: universalScore,
      technical_ratings: technicalScores
    };

    try {
      const res = await fetch(`${API_URL}/experience`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, // ✅ Envoi du badge
          'Content-Type': 'application/json' 
        },
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

  // --- SUPPRESSION (Sécurisée) ---
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
              const res = await fetch(`${API_URL}/experience/${id}`, { 
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` } // ✅ Envoi du badge
              });
              if (res.ok) fetchExperiences();
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

// --- LE RESTE DU CODE (SANS CHANGEMENT) ---

  const renderItem = ({ item }) => {
    const ratings = typeof item.technical_ratings === 'string' 
      ? JSON.parse(item.technical_ratings) 
      : (item.technical_ratings || {});

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardCategory}>{item.category}</Text>
            <Text style={styles.cardAuthor}>Par {item.pseudo || 'Anonyme'}</Text>
          </View>
          {item.user_id === currentUser?.id && (
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>Effacer 🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.stars}>
          {'★'.repeat(item.universal_score)}{'☆'.repeat(5 - item.universal_score)}
        </Text>
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

  const renderProfile = () => {
    const myExperiences = feed.filter(item => item.user_id === currentUser.id);
    return (
      <View style={styles.profileContainer}>
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
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>
              Tu n'as pas encore publié de note.
            </Text>
          }
        />
        <TouchableOpacity style={styles.logoutBtn} onPress={() => {setCurrentUser(null); setToken(null);}}>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (!currentUser) {
    return (
      <View style={styles.loginContainer}>
        <Text style={styles.loginTitle}>How Many</Text>
        <TextInput 
          style={styles.loginInput} 
          placeholder="Ton pseudo..." 
          value={pseudoInput}
          onChangeText={setPseudoInput}
          onSubmitEditing={handleLogin}
        />
        <TextInput 
          style={styles.loginInput} 
          placeholder="Mot de passe..." 
          value={passwordInput}
          onChangeText={setPasswordInput}
          secureTextEntry={true} 
        />
        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
          <Text style={styles.loginBtnText}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setView('feed')}>
          <Text style={[styles.headerNav, view === 'feed' && styles.headerActive]}>Flux</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setView('profile')}>
          <Text style={[styles.headerNav, view === 'profile' && styles.headerActive]}>Mon Profil</Text>
        </TouchableOpacity>
      </View>

      {view === 'feed' ? (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchExperiences()} />}
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
              <TextInput style={styles.input} placeholder="Titre de l'expérience..." value={title} onChangeText={setTitle} />
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
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15 },
  bigStar: { fontSize: 40, color: '#FFD700', marginHorizontal: 5 },
  techRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  techLabel: { fontSize: 14, color: '#666' },
  smallPoint: { fontSize: 22, color: '#007AFF', marginHorizontal: 3 },
  postBtn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  postBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  feedTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 30, marginBottom: 10 },
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
  loginContainer: { flex: 1, justifyContent: 'center', padding: 40, backgroundColor: '#fff' },
  loginTitle: { fontSize: 45, fontWeight: '900', color: '#007AFF', textAlign: 'center', marginBottom: 50 },
  loginInput: { borderBottomWidth: 2, borderColor: '#007AFF', padding: 15, fontSize: 20, marginBottom: 30 },
  loginBtn: { backgroundColor: '#007AFF', padding: 20, borderRadius: 20, alignItems: 'center' },
  loginBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5 },
  headerNav: { fontSize: 16, fontWeight: 'bold', color: '#999', paddingVertical: 10 },
  headerActive: { color: '#007AFF', borderBottomWidth: 3, borderBottomColor: '#007AFF' },
  welcomeText: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  profileContainer: { flex: 1, padding: 10 },
  profileCard: { alignItems: 'center', backgroundColor: '#fff', padding: 25, borderRadius: 25, margin: 10, elevation: 4 },
  avatarLarge: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  profileName: { fontSize: 22, fontWeight: 'bold' },
  profileStats: { color: '#666', marginTop: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 15, marginLeft: 20 },
  logoutBtn: { marginTop: 10, padding: 15, alignItems: 'center' },
  logoutText: { color: '#FF3B30', fontWeight: 'bold' },
});