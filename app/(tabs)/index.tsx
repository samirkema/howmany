import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  Alert, FlatList, RefreshControl, KeyboardAvoidingView, Platform,
  ImageBackground, StatusBar, ScrollView, Modal, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// ─── CATÉGORIES (issues du fichier HOW MANY CATÉGORIES.xlsx) ───────────────
const CRITERIA: Record<string, string[]> = {
  // IMPLANTÉES
  Film:         ['Scénario', 'Réalisation', 'Acteurs'],
  Resto:        ['Qualité plats', 'Service', 'Ambiance'],
  Voyage:       ['Paysages', 'Activités', 'Coût'],
  Musique:      ['Mélodie', 'Paroles', 'Voix'],
  // EN PROJET
  'Jeux Vidéo': ['Gameplay', 'Graphismes', 'Histoire'],
  Événements:   ['Ambiance', 'Organisation', 'Lieu'],
  'Vidéos YouTube': ['Contenu', 'Montage', 'Originalité'],
  Lectures:     ['Histoire', 'Style', 'Rythme'],
  Recettes:     ['Goût', 'Facilité', 'Présentation'],
  'Musée / Expo': ['Œuvres', 'Scénographie', 'Rapport qualité/prix'],
};

const CAT_EMOJI: Record<string, string> = {
  Film: '🎬',
  Resto: '🍽️',
  Voyage: '✈️',
  Musique: '🎵',
  'Jeux Vidéo': '🎮',
  Événements: '🎪',
  'Vidéos YouTube': '▶️',
  Lectures: '📚',
  Recettes: '🍳',
  'Musée / Expo': '🖼️',
};

const ALL_CATEGORIES = Object.keys(CRITERIA);

// ─── COMPOSANT PRINCIPAL ───────────────────────────────────────────────────
export default function HomeScreen() {
  const API_URL = 'https://howmany.onrender.com';

  // Auth
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pseudoInput, setPseudoInput]   = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError]     = useState('');

  // Navigation principale
  const [view, setView] = useState<'feed'|'feedAmis'|'profile'|'friendsList'|'userProfile'>('feed');

  // Formulaire de publication
  const [category, setCategory]         = useState('Film');
  const [title, setTitle]               = useState('');
  const [universalScore, setUniversalScore] = useState(0);
  const [technicalScores, setTechnicalScores] = useState<Record<string,number>>({});
  const [showAllCats, setShowAllCats]   = useState(false);
  const [postPhotos, setPostPhotos]     = useState<string[]>([]);
  const [postVisibility, setPostVisibility] = useState<'public'|'friends'|'private'>('public');

  // Feed
  const [feed, setFeed]                 = useState<any[]>([]);
  const [friendsFeed, setFriendsFeed]   = useState<any[]>([]);
  const [refreshing, setRefreshing]     = useState(false);
  const [myExps, setMyExps]             = useState<any[]>([]);

  // Top 3 catégories
  const [topCats, setTopCats]           = useState<string[]>([]);

  // Amis
  const [friendsList, setFriendsList]   = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);

  // Profil d'un autre utilisateur
  const [viewedUser, setViewedUser]     = useState<any>(null);
  const [viewedUserExps, setViewedUserExps] = useState<any[]>([]);

  // ── Au login ──
  const handleLogin = async () => {
    setLoginError('');
    if (!pseudoInput.trim() || !passwordInput.trim()) {
      setLoginError('Il faut un pseudo ET un mot de passe.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: pseudoInput.trim(), password: passwordInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data);
        fetchExperiences();
        fetchMyExps(data.id);
        fetchTopCats(data.id);
        fetchFriendRequests(data.id);
      } else {
        setLoginError('Mauvais mot de passe.');
      }
    } catch {
      setLoginError('Impossible de joindre le serveur.');
    }
  };

  // ── Feeds ──
  const fetchExperiences = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/experiences`);
      setFeed(await res.json());
    } catch {}
    finally { setRefreshing(false); }
  };

  const fetchMyExps = async (userId: number) => {
    try {
      const res = await fetch(`${API_URL}/user/${userId}/experiences?viewer_id=${userId}`);
      setMyExps(await res.json());
    } catch {}
  };

  const fetchFriendsFeed = async () => {
    if (!currentUser) return;
    setRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/experiences/friends/${currentUser.id}`);
      setFriendsFeed(await res.json());
    } catch {}
    finally { setRefreshing(false); }
  };

  // ── Top catégories ──
  const fetchTopCats = async (userId: number) => {
    try {
      const res = await fetch(`${API_URL}/user/${userId}/top-categories`);
      const data = await res.json();
      setTopCats(data);
    } catch {}
  };

  // ── Amis ──
  const fetchFriendsList = async () => {
    try {
      const res = await fetch(`${API_URL}/user/${currentUser.id}/friends?viewer_id=${currentUser.id}`);
      setFriendsList(await res.json());
    } catch {}
  };

  const fetchFriendRequests = async (userId: number) => {
    try {
      const res = await fetch(`${API_URL}/user/${userId}/friend-requests`);
      setFriendRequests(await res.json());
    } catch {}
  };

  const sendFriendRequest = async (receiverId: number) => {
    try {
      await fetch(`${API_URL}/friendship/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester_id: currentUser.id, receiver_id: receiverId }),
      });
      openUserProfile(receiverId); // refresh
    } catch {}
  };

  const acceptFriendRequest = async (requesterId: number) => {
    try {
      await fetch(`${API_URL}/friendship/accept`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester_id: requesterId, receiver_id: currentUser.id }),
      });
      fetchFriendRequests(currentUser.id);
      fetchFriendsList();
    } catch {}
  };

  const removeFriend = async (otherId: number) => {
    try {
      await fetch(`${API_URL}/friendship`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, other_id: otherId }),
      });
      fetchFriendsList();
    } catch {}
  };

  // ── Changer la photo de profil ──
  const handleChangeAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Autorise l\'accès à ta galerie dans les réglages.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled || !result.assets[0].base64) return;
    const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
    try {
      await fetch(`${API_URL}/user/${currentUser.id}/avatar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: base64 }),
      });
      setCurrentUser((u: any) => ({ ...u, avatar_url: base64 }));
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour la photo.');
    }
  };

  // ── Profil d'un autre utilisateur ──
  const openUserProfile = async (userId: number) => {
    try {
      const [profRes, expRes] = await Promise.all([
        fetch(`${API_URL}/user/${userId}/profile?viewer_id=${currentUser.id}`),
        fetch(`${API_URL}/user/${userId}/experiences?viewer_id=${currentUser.id}`),
      ]);
      setViewedUser(await profRes.json());
      setViewedUserExps(await expRes.json());
      setView('userProfile');
    } catch {}
  };

  // ── Photos du post ──
  const handleAddPostPhoto = async () => {
    if (postPhotos.length >= 4) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée', 'Autorise l\'accès à ta galerie.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.5,
      base64: true,
      allowsMultipleSelection: true,
      selectionLimit: 4 - postPhotos.length,
    });
    if (result.canceled) return;
    const newPhotos = result.assets
      .filter(a => a.base64)
      .map(a => `data:image/jpeg;base64,${a.base64}`);
    setPostPhotos(prev => [...prev, ...newPhotos].slice(0, 4));
  };

  const handleChangeVisibility = async (expId: number, newVis: 'public'|'friends'|'private') => {
    try {
      await fetch(`${API_URL}/experience/${expId}/visibility`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVis, user_id: currentUser.id }),
      });
      // Mettre à jour localement
      setFeed(prev => prev.map(e => e.id === expId ? { ...e, visibility: newVis } : e));
      setMyExps(prev => prev.map(e => e.id === expId ? { ...e, visibility: newVis } : e));
    } catch { Alert.alert('Erreur', 'Impossible de changer la visibilité.'); }
  };

  // ── Publication ──
  const handleSubmit = async () => {
    if (!title || universalScore === 0) {
      Alert.alert('Oups', 'Il manque le titre ou ton ressenti !');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/experience`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id, category, title,
          universal_score: universalScore, technical_ratings: technicalScores,
          photos: postPhotos, visibility: postVisibility,
        }),
      });
      if (res.ok) {
        setTitle(''); setUniversalScore(0); setTechnicalScores({});
        setPostPhotos([]); setPostVisibility('public');
        fetchExperiences();
        fetchMyExps(currentUser.id);
        fetchTopCats(currentUser.id);
      }
    } catch { Alert.alert('Erreur', 'Impossible de publier.'); }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Supprimer', 'Effacer cette note ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await fetch(`${API_URL}/experience/${id}`, { method: 'DELETE' });
        fetchExperiences();
        fetchMyExps(currentUser.id);
      }},
    ]);
  };

  // ── Catégories affichées dans le formulaire (top 3 + Plus) ──
  const displayedCats: string[] = topCats.length >= 3
    ? topCats.slice(0, 3)
    : [
        ...topCats,
        ...ALL_CATEGORIES.filter(c => !topCats.includes(c)).slice(0, 3 - topCats.length),
      ];

  // ── Rendu d'une carte expérience ──
  const renderCard = (item: any, showDelete = false) => {
    const ratings = typeof item.technical_ratings === 'string'
      ? JSON.parse(item.technical_ratings)
      : (item.technical_ratings || {});

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.card}
        onPress={() => item.user_id !== currentUser.id && openUserProfile(item.user_id)}
        activeOpacity={item.user_id !== currentUser.id ? 0.7 : 1}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardCategory}>{CAT_EMOJI[item.category] || '📌'} {item.category}</Text>
            <Text style={styles.cardAuthor}>Par {item.pseudo || 'Anonyme'}</Text>
          </View>
          {showDelete && item.user_id === currentUser?.id && (
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.stars}>
          {'★'.repeat(item.universal_score)}{'☆'.repeat(5 - item.universal_score)}
        </Text>
        <View style={styles.techGrid}>
          {Object.entries(ratings).map(([key, val]: any) => (
            <View key={key} style={styles.techBadge}>
              <Text style={styles.techText}>{key}: {val}/5</Text>
            </View>
          ))}
        </View>
        {/* Photos */}
        {item.photos && item.photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {item.photos.map((uri: string, i: number) => (
              <Image key={i} source={{ uri }} style={styles.cardPhoto} />
            ))}
          </ScrollView>
        )}
        {/* Visibilité — switch pour ses propres notes */}
        {showDelete && item.user_id === currentUser?.id && (
          <View style={styles.visibilityBar}>
            {(['public','friends','private'] as const).map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.visSmallBtn, item.visibility === v && styles.visSmallBtnActive]}
                onPress={() => handleChangeVisibility(item.id, v)}
              >
                <Text style={[styles.visSmallTxt, item.visibility === v && styles.visSmallTxtActive]}>
                  {v === 'public' ? '🌍' : v === 'friends' ? '👥' : '🔒'}
                </Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.visLabel}>
              {item.visibility === 'public' ? 'Public' : item.visibility === 'friends' ? 'Amis' : 'Privé'}
            </Text>
          </View>
        )}
        {/* Badge visibilité (lecture seule) pour les autres */}
        {(!showDelete || item.user_id !== currentUser?.id) && item.visibility && item.visibility !== 'public' && (
          <Text style={styles.visBadge}>
            {item.visibility === 'friends' ? '👥 Amis' : '🔒 Privé'}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // ── Formulaire de sélection de toutes les catégories (modale) ──
  const CatModal = () => (
    <Modal visible={showAllCats} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Catégories</Text>
        <TouchableOpacity onPress={() => setShowAllCats(false)}>
          <Text style={styles.modalClose}>Fermer</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.modalGrid}>
        {ALL_CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.modalCatCard, category === cat && styles.modalCatActive]}
            onPress={() => { setCategory(cat); setTechnicalScores({}); setShowAllCats(false); }}
          >
            <Text style={styles.modalCatEmoji}>{CAT_EMOJI[cat]}</Text>
            <Text style={[styles.modalCatLabel, category === cat && styles.modalCatLabelActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Modal>
  );

  // ── Formulaire de publication (header du feed) ──
  const renderForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.welcomeText}>Salut, {currentUser.pseudo} 👋</Text>
      <Text style={styles.formSectionLabel}>✏️ Publier une note</Text>
      <View style={styles.formCard}>

      {/* Sélection catégorie : top 3 + Plus */}
      <View style={styles.categoryRow}>
        {displayedCats.map(cat => (
          <TouchableOpacity
            key={cat}
            onPress={() => { setCategory(cat); setTechnicalScores({}); }}
            style={[styles.catBtn, category === cat && styles.catBtnActive]}
          >
            <Text style={styles.catEmoji}>{CAT_EMOJI[cat]}</Text>
            <Text style={[styles.catTxt, category === cat && styles.catTxtActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.catMoreBtn} onPress={() => setShowAllCats(true)}>
          <Text style={styles.catMorePlus}>＋</Text>
          <Text style={styles.catMoreTxt}>Plus</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Titre de l'expérience..."
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.ressentLabel}>Mon ressenti</Text>
      <View style={styles.starsRow}>
        {[1,2,3,4,5].map(s => (
          <TouchableOpacity key={s} onPress={() => setUniversalScore(s)}>
            <Text style={styles.bigStar}>{s <= universalScore ? '★' : '☆'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {CRITERIA[category]?.map(crit => (
        <View key={crit} style={styles.techRow}>
          <Text style={styles.techLabel}>{crit}</Text>
          <View style={{ flexDirection: 'row' }}>
            {[1,2,3,4,5].map(s => (
              <TouchableOpacity key={s} onPress={() => setTechnicalScores(p => ({ ...p, [crit]: s }))}>
                <Text style={styles.smallPoint}>{s <= (technicalScores[crit] || 0) ? '●' : '○'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* Photos */}
      <View style={styles.photoRow}>
        {postPhotos.map((uri, i) => (
          <View key={i} style={styles.photoThumbWrap}>
            <Image source={{ uri }} style={styles.photoThumb} />
            <TouchableOpacity style={styles.photoRemove} onPress={() => setPostPhotos(p => p.filter((_, j) => j !== i))}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {postPhotos.length < 4 && (
          <TouchableOpacity style={styles.photoAddBtn} onPress={handleAddPostPhoto}>
            <Text style={styles.photoAddIcon}>📷</Text>
            <Text style={styles.photoAddTxt}>{postPhotos.length === 0 ? 'Ajouter' : '+'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Visibilité */}
      <View style={styles.visibilityRow}>
        {(['public','friends','private'] as const).map(v => (
          <TouchableOpacity
            key={v}
            style={[styles.visBtn, postVisibility === v && styles.visBtnActive]}
            onPress={() => setPostVisibility(v)}
          >
            <Text style={[styles.visBtnTxt, postVisibility === v && styles.visBtnTxtActive]}>
              {v === 'public' ? '🌍 Public' : v === 'friends' ? '👥 Amis' : '🔒 Privé'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.postBtn} onPress={handleSubmit}>
        <Text style={styles.postBtnText}>Publier la note</Text>
      </TouchableOpacity>
      </View>
      <Text style={styles.feedTitle}>Dernières expériences</Text>
    </View>
  );

  // ── Vue profil personnel ──
  const renderProfile = () => {
    return (
      <ScrollView style={styles.profileContainer}>
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={handleChangeAvatar} style={styles.avatarWrapper}>
            {currentUser.avatar_url ? (
              <Image source={{ uri: currentUser.avatar_url }} style={styles.avatarLargeImg} />
            ) : (
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{currentUser.pseudo[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditIcon}>✏️</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{currentUser.pseudo}</Text>
          <Text style={styles.profileStats}>{myExps.length} expériences partagées</Text>
        </View>

        {/* Demandes d'amis reçues */}
        {friendRequests.length > 0 && (
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Demandes d'amis ({friendRequests.length})</Text>
            {friendRequests.map(req => (
              <View key={req.id} style={styles.friendRequestRow}>
                <Text style={styles.friendRequestName}>{req.pseudo}</Text>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptFriendRequest(req.id)}>
                  <Text style={styles.acceptBtnTxt}>Accepter</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Accès liste d'amis */}
        <TouchableOpacity style={styles.friendsListBtn} onPress={() => { fetchFriendsList(); setView('friendsList'); }}>
          <Text style={styles.friendsListBtnTxt}>👥 Mes amis</Text>
          <Text style={styles.friendsListArrow}>→</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Mon Journal de Bord</Text>
        {myExps.map(item => renderCard(item, true))}
        {myExps.length === 0 && (
          <Text style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>
            Tu n'as pas encore publié de note.
          </Text>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setCurrentUser(null)}>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
        <View style={{ height: 80 }} />
      </ScrollView>
    );
  };

  // ── Vue liste d'amis ──
  const renderFriendsList = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={() => setView('profile')}>
          <Text style={styles.backBtn}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.subHeaderTitle}>Mes amis</Text>
        <View style={{ width: 60 }} />
      </View>
      <FlatList
        data={friendsList}
        keyExtractor={i => i.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={{ textAlign:'center', color:'#999', marginTop:30 }}>Pas encore d'amis.</Text>}
        renderItem={({ item }) => (
          <View style={styles.friendRow}>
            <TouchableOpacity style={styles.friendInfo} onPress={() => openUserProfile(item.id)}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.friendAvatarImg} />
              ) : (
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendAvatarTxt}>{item.pseudo[0].toUpperCase()}</Text>
                </View>
              )}
              <View>
                <Text style={styles.friendName}>{item.pseudo}</Text>
                <Text style={styles.friendSub}>{item.experience_count} expériences</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Retirer', `Retirer ${item.pseudo} de tes amis ?`, [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Retirer', style: 'destructive', onPress: () => removeFriend(item.id) },
            ])}>
              <Text style={{ color: '#FF3B30', fontWeight: '600' }}>Retirer</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );

  // ── Vue profil d'un autre utilisateur ──
  const renderUserProfile = () => {
    if (!viewedUser) return null;
    const { pseudo, experience_count, friendship_status } = viewedUser;

    const FriendButton = () => {
      if (friendship_status === 'accepted') return (
        <View style={styles.friendBadge}><Text style={styles.friendBadgeTxt}>✓ Amis</Text></View>
      );
      if (friendship_status === 'pending_sent') return (
        <View style={[styles.friendBadge, { backgroundColor: '#f0f0f0' }]}>
          <Text style={[styles.friendBadgeTxt, { color: '#999' }]}>Demande envoyée</Text>
        </View>
      );
      if (friendship_status === 'pending_received') return (
        <TouchableOpacity style={styles.addFriendBtn} onPress={() => acceptFriendRequest(viewedUser.id)}>
          <Text style={styles.addFriendTxt}>Accepter la demande</Text>
        </TouchableOpacity>
      );
      return (
        <TouchableOpacity style={styles.addFriendBtn} onPress={() => sendFriendRequest(viewedUser.id)}>
          <Text style={styles.addFriendTxt}>+ Demander en ami</Text>
        </TouchableOpacity>
      );
    };

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={() => setView('feed')}>
            <Text style={styles.backBtn}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>{pseudo}</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          <View style={styles.profileCard}>
            {viewedUser.avatar_url ? (
              <Image source={{ uri: viewedUser.avatar_url }} style={styles.avatarLargeImg} />
            ) : (
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{pseudo[0].toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.profileName}>{pseudo}</Text>
            <Text style={styles.profileStats}>{experience_count} expériences partagées</Text>
            <FriendButton />
          </View>
          <Text style={styles.sectionTitle}>Ses expériences</Text>
          {viewedUserExps.map(item => renderCard(item, false))}
          {viewedUserExps.length === 0 && (
            <Text style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>Aucune expérience publiée.</Text>
          )}
        </ScrollView>
      </View>
    );
  };

  // ── ÉCRAN CONNEXION ──
  if (!currentUser) {
    return (
      <View style={styles.loginWrapper}>
        <StatusBar barStyle="light-content" />
        <ImageBackground
          source={require('../../assets/images/login-bg-2.jpg')}
          style={styles.loginBg}
          resizeMode="cover"
          imageStyle={Platform.OS !== 'web' ? { top: 0 } : undefined}
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
                  onChangeText={t => { setPseudoInput(t); setLoginError(''); }}
                  onSubmitEditing={handleLogin}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.loginInput}
                  placeholder="Mot de passe..."
                  placeholderTextColor="#999"
                  value={passwordInput}
                  onChangeText={t => { setPasswordInput(t); setLoginError(''); }}
                  secureTextEntry
                  onSubmitEditing={handleLogin}
                />
                {loginError ? <Text style={styles.loginError}>{loginError}</Text> : null}
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

  // ── ÉCRAN PRINCIPAL ──
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <CatModal />

      {/* HEADER */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => { setView('feed'); fetchExperiences(); }}>
          <Text style={[styles.headerNav, view === 'feed' && styles.headerActive]}>Pour toi</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setView('feedAmis'); fetchFriendsFeed(); }}>
          <Text style={[styles.headerNav, view === 'feedAmis' && styles.headerActive]}>Amis</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setView('profile'); fetchFriendRequests(currentUser.id); fetchMyExps(currentUser.id); }}>
          <Text style={[styles.headerNav, view === 'profile' && styles.headerActive]}>
            Mon Profil{friendRequests.length > 0 ? ` (${friendRequests.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTENU */}
      {view === 'feed' && (
        <FlatList
          data={feed}
          keyExtractor={i => i.id.toString()}
          renderItem={({ item }) => renderCard(item, true)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchExperiences} />}
          ListHeaderComponent={renderForm()}
        />
      )}

      {view === 'feedAmis' && (
        <FlatList
          data={friendsFeed}
          keyExtractor={i => i.id.toString()}
          renderItem={({ item }) => renderCard(item, false)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchFriendsFeed} />}
          ListHeaderComponent={<Text style={[styles.feedTitle, { padding: 20 }]}>Notes de tes amis</Text>}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: '#999', marginTop: 40, paddingHorizontal: 30 }}>
              Tes amis n'ont pas encore publié, ou tu n'as pas encore d'amis.
            </Text>
          }
        />
      )}

      {view === 'profile' && renderProfile()}
      {view === 'friendsList' && renderFriendsList()}
      {view === 'userProfile' && renderUserProfile()}
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', paddingTop: 60 },

  // Header navigation
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5,
  },
  headerNav: { fontSize: 15, fontWeight: 'bold', color: '#999', paddingVertical: 10 },
  headerActive: { color: '#007AFF', borderBottomWidth: 3, borderBottomColor: '#007AFF' },

  // Sub-header (profil autre, liste amis)
  subHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
    paddingHorizontal: 16, paddingVertical: 12, paddingTop: 16,
  },
  subHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  backBtn: { color: '#007AFF', fontWeight: '600', fontSize: 16 },

  // Formulaire
  formContainer: { padding: 20, paddingBottom: 10, backgroundColor: '#fff', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 5 },
  formSectionLabel: { fontSize: 13, fontWeight: '800', color: '#007AFF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  formCard: {
    backgroundColor: '#F0F4FF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D6E4FF',
    marginBottom: 4,
  },
  welcomeText: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  categoryRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15, gap: 8 },
  catBtn: {
    alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 14, backgroundColor: '#f0f0f5', borderWidth: 2, borderColor: 'transparent',
  },
  catBtnActive: { backgroundColor: '#EBF5FF', borderColor: '#007AFF' },
  catEmoji: { fontSize: 18 },
  catTxt: { fontSize: 11, fontWeight: '700', color: '#666', marginTop: 2 },
  catTxtActive: { color: '#007AFF' },
  catMoreBtn: {
    alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 14, borderWidth: 2, borderColor: '#ddd', borderStyle: 'dashed',
  },
  catMorePlus: { fontSize: 18, color: '#aaa' },
  catMoreTxt: { fontSize: 11, fontWeight: '700', color: '#aaa', marginTop: 2 },
  input: { borderBottomWidth: 1, borderColor: '#ddd', padding: 10, fontSize: 18, marginBottom: 15 },
  ressentLabel: { fontSize: 12, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15 },
  bigStar: { fontSize: 38, color: '#FFD700', marginHorizontal: 4 },
  techRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  techLabel: { fontSize: 14, color: '#666' },
  smallPoint: { fontSize: 22, color: '#007AFF', marginHorizontal: 3 },
  postBtn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  postBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  feedTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 28, marginBottom: 8 },

  // Cartes
  card: { backgroundColor: '#fff', padding: 20, marginHorizontal: 16, marginBottom: 14, borderRadius: 20, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'flex-start' },
  cardCategory: { fontSize: 12, color: '#007AFF', fontWeight: 'bold', textTransform: 'uppercase' },
  cardAuthor: { fontSize: 12, color: '#999', fontWeight: '600', marginTop: 2 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  stars: { fontSize: 20, color: '#FFD700', marginBottom: 10 },
  techGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  techBadge: { backgroundColor: '#f0f0f5', padding: 6, borderRadius: 8 },
  techText: { fontSize: 11, color: '#555' },
  deleteBtn: { padding: 6, backgroundColor: '#FFE5E5', borderRadius: 8 },
  deleteBtnText: { color: '#FF3B30', fontWeight: 'bold', fontSize: 13 },

  // Photos dans le formulaire
  photoRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 64, height: 64, borderRadius: 10 },
  photoRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center',
  },
  photoAddBtn: {
    width: 64, height: 64, borderRadius: 10,
    backgroundColor: '#f0f0f5', borderWidth: 1.5, borderColor: '#ddd', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  photoAddIcon: { fontSize: 20 },
  photoAddTxt: { fontSize: 10, color: '#aaa', fontWeight: '700', marginTop: 2 },

  // Visibilité dans le formulaire
  visibilityRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  visBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: '#f0f0f5', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  visBtnActive: { backgroundColor: '#EBF5FF', borderColor: '#007AFF' },
  visBtnTxt: { fontSize: 12, fontWeight: '700', color: '#888' },
  visBtnTxtActive: { color: '#007AFF' },

  // Photos dans les cartes
  cardPhoto: { width: 120, height: 90, borderRadius: 10, marginRight: 8 },

  // Barre visibilité sur ses propres notes
  visibilityBar: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  visSmallBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#f0f0f5', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  visSmallBtnActive: { backgroundColor: '#EBF5FF', borderColor: '#007AFF' },
  visSmallTxt: { fontSize: 14 },
  visSmallTxtActive: { fontSize: 14 },
  visLabel: { fontSize: 12, color: '#888', fontWeight: '600', marginLeft: 4 },
  visBadge: { fontSize: 12, color: '#888', marginTop: 8, fontWeight: '600' },

  // Profil personnel
  profileContainer: { flex: 1 },
  profileCard: { alignItems: 'center', backgroundColor: '#fff', padding: 25, borderRadius: 25, margin: 16, elevation: 4 },
  avatarWrapper: { position: 'relative', marginBottom: 10 },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  avatarLargeImg: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#eee', elevation: 2,
  },
  avatarEditIcon: { fontSize: 13 },
  profileName: { fontSize: 22, fontWeight: 'bold' },
  profileStats: { color: '#666', marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginVertical: 12, marginHorizontal: 16 },

  // Demandes d'amis
  sectionBox: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 16, elevation: 2 },
  friendRequestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  friendRequestName: { fontSize: 16, fontWeight: '700' },
  acceptBtn: { backgroundColor: '#007AFF', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  acceptBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Bouton liste d'amis
  friendsListBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', margin: 16, marginTop: 0, borderRadius: 16, padding: 16, elevation: 2,
  },
  friendsListBtnTxt: { fontSize: 16, fontWeight: '700', color: '#111' },
  friendsListArrow: { fontSize: 18, color: '#aaa' },

  // Liste d'amis
  friendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2 },
  friendInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  friendAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  friendAvatarImg: { width: 42, height: 42, borderRadius: 21 },
  friendAvatarTxt: { color: '#fff', fontWeight: '800', fontSize: 17 },
  friendName: { fontSize: 16, fontWeight: '700' },
  friendSub: { fontSize: 12, color: '#aaa', marginTop: 2 },

  // Profil autre utilisateur
  addFriendBtn: { marginTop: 14, backgroundColor: '#007AFF', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  addFriendTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  friendBadge: { marginTop: 14, backgroundColor: '#E8F5E9', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  friendBadgeTxt: { color: '#34C759', fontWeight: '700', fontSize: 14 },

  // Déconnexion
  logoutBtn: { marginTop: 16, padding: 15, alignItems: 'center' },
  logoutText: { color: '#FF3B30', fontWeight: 'bold', fontSize: 15 },

  // Modal catégories
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalClose: { color: '#007AFF', fontWeight: '600', fontSize: 16 },
  modalGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  modalCatCard: {
    width: '30%', alignItems: 'center', backgroundColor: '#f5f5f8',
    borderRadius: 16, padding: 16, borderWidth: 2, borderColor: 'transparent',
  },
  modalCatActive: { borderColor: '#007AFF', backgroundColor: '#EBF5FF' },
  modalCatEmoji: { fontSize: 28, marginBottom: 6 },
  modalCatLabel: { fontSize: 12, fontWeight: '700', color: '#555', textAlign: 'center' },
  modalCatLabelActive: { color: '#007AFF' },

  // Login
  loginWrapper: { flex: 1, ...(Platform.OS === 'web' ? { height: '100vh' as any, overflow: 'hidden' as any } : {}) },
  loginBg: { flex: 1, width: '100%', ...(Platform.OS === 'web' ? { height: '100vh' as any, minHeight: '100vh' as any } : {}) },
  loginOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'center', alignItems: 'center', padding: 24, paddingBottom: 60 },
  loginCard: { width: '100%', maxWidth: 420 },
  loginTitle: { fontSize: 44, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 48, letterSpacing: -1 },
  loginForm: { gap: 14 },
  loginInput: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16, fontSize: 16, color: '#111' },
  loginError: { color: '#FF6B6B', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  loginBtn: { backgroundColor: '#007AFF', paddingVertical: 17, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  loginBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
});
