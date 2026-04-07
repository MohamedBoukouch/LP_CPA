// script.js — GameHub
// Adapted for the playgama games.json format:
// data.segments[0].hits[] with fields:
//   id, title, genres[], tags[], images[], gameURL, description, mobileReady[], embed

// ─── Favorites System (localStorage) ────────────────────────────────────
const FAVORITES_KEY = 'x7ero_favorites';

function loadFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.warn('Could not load favorites:', e);
    return [];
  }
}

function saveFavorites(favorites) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (e) {
    console.warn('Could not save favorites:', e);
  }
}

function updateFavCount(count) {
  const badge = document.getElementById('headerFavCount');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

class GameHub {
  constructor() {
    this.allGames   = [];   // full list from JSON
    this.games      = [];   // currently displayed list
    this.currentCategory = 'all';
    this.currentFilter   = 'all';
    this.currentGame     = null;
    this.searchQuery     = '';
    this.favorites       = loadFavorites();
    this.isFullscreen    = false;
    this.init();
  }

  // ─── Bootstrap ────────────────────────────────────────────────────────────

  async init() {
    await this.loadGames();
    this.setupSidebar();
    this.setupFilters();
    this.setupSearch();
    this.setupMobileMenu();
    this.setupFullscreen();
    this.setupFavorites();
    this.applyFilters();
    updateFavCount(this.favorites.length);
  }

  // ─── Data Loading ─────────────────────────────────────────────────────────

  async loadGames() {
    try {
      const res = await fetch('games.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Support both a raw array AND the playgama envelope format
      if (Array.isArray(data)) {
        this.allGames = data;
      } else if (data.segments && data.segments[0] && data.segments[0].hits) {
        this.allGames = data.segments[0].hits;
      } else {
        throw new Error('Unrecognised games.json structure');
      }
    } catch (err) {
      console.error('Could not load games.json:', err);
      document.getElementById('gamesGrid').innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor" width="64" height="64">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <h3>Failed to load games</h3>
          <p>Make sure games.json is in the same folder as index.html</p>
        </div>`;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Return the primary thumbnail for a game */
  getImage(game) {
    return (game.images && game.images[0]) || '';
  }

  /** Return a combined genre+tag array (lower-cased) */
  getAllGenres(game) {
    const g = Array.isArray(game.genres) ? game.genres : [];
    const t = Array.isArray(game.tags)   ? game.tags   : [];
    return [...g, ...t].map(s => s.toLowerCase());
  }

  /** Normalise a category slug so sidebar labels match genre values */
  categoryMatchesGame(game, category) {
    if (category === 'all') return true;
    const genres = this.getAllGenres(game);
    // direct match
    if (genres.includes(category)) return true;
    // compound-tag match (e.g. "action-fighting" for category "action")
    if (genres.some(g => g.startsWith(category + '-') || g.endsWith('-' + category))) return true;
    return false;
  }

  /** Determine if game supports mobile / desktop */
  isMobileReady(game) {
    if (!game.mobileReady) return false;
    return game.mobileReady.some(p => /android|ios/i.test(p));
  }
  isDesktopReady(game) {
    if (!game.mobileReady) return true; // assume desktop if no info
    return game.mobileReady.some(p => /desktop/i.test(p));
  }

  // ─── Favorites System ────────────────────────────────────────────────────

  isFavorite(gameId) {
    return this.favorites.includes(String(gameId));
  }

  toggleFavorite(gameId, event) {
    if (event) event.stopPropagation();
    
    const id = String(gameId);
    const index = this.favorites.indexOf(id);
    
    if (index > -1) {
      this.favorites.splice(index, 1);
    } else {
      this.favorites.push(id);
    }
    
    saveFavorites(this.favorites);
    updateFavCount(this.favorites.length);
    
    // Re-render to update heart icons
    if (document.getElementById('favoritesSection').style.display === 'block') {
      this.renderFavorites();
    } else {
      this.applyFilters();
    }
    
    // Update favorite button if current game
    if (this.currentGame && String(this.currentGame.id) === id) {
      this.updateFavoriteButton();
    }
  }

  toggleCurrentFavorite() {
    if (!this.currentGame) return;
    this.toggleFavorite(this.currentGame.id);
  }

  updateFavoriteButton() {
    const btn = document.getElementById('favoriteBtn');
    const icon = document.getElementById('favIcon');
    if (!btn || !this.currentGame) return;
    
    const isFav = this.isFavorite(this.currentGame.id);
    btn.classList.toggle('active', isFav);
    if (icon) icon.style.fill = isFav ? '#fff' : 'currentColor';
  }

  setupFavorites() {
    // My Games button in header
    const myGamesBtn = document.getElementById('myGamesBtn');
    if (myGamesBtn) {
      myGamesBtn.addEventListener('click', () => this.showFavorites());
    }
    
    // Favorite button in game player
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (favoriteBtn) {
      favoriteBtn.addEventListener('click', () => this.toggleCurrentFavorite());
    }
    
    // Back to all games button
    const backToAllBtn = document.getElementById('backToAllBtn');
    if (backToAllBtn) {
      backToAllBtn.addEventListener('click', () => this.showAllGames());
    }
  }

  showFavorites() {
    const gamesSection = document.getElementById('gamesSection');
    const favoritesSection = document.getElementById('favoritesSection');
    const heroSection = document.getElementById('heroSection');
    
    if (gamesSection) gamesSection.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    if (favoritesSection) favoritesSection.style.display = 'block';
    
    this.renderFavorites();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showAllGames() {
    const gamesSection = document.getElementById('gamesSection');
    const favoritesSection = document.getElementById('favoritesSection');
    const heroSection = document.getElementById('heroSection');
    
    if (favoritesSection) favoritesSection.style.display = 'none';
    if (gamesSection) gamesSection.style.display = 'block';
    if (heroSection && this.currentGame) heroSection.style.display = 'block';
    
    this.applyFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderFavorites() {
    const grid = document.getElementById('favoritesGrid');
    const emptyState = document.getElementById('emptyFavorites');
    
    if (!grid) return;
    
    const favoriteGames = this.allGames.filter(game => this.isFavorite(game.id));
    
    if (favoriteGames.length === 0) {
      grid.innerHTML = '';
      if (emptyState) {
        grid.appendChild(emptyState);
        emptyState.style.display = 'block';
      }
      return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    grid.innerHTML = favoriteGames.map(game => this.createGameCard(game)).join('');
    
    // Add click handlers
    grid.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.game-card-fav')) {
          this.toggleFavorite(card.dataset.id, e);
        } else {
          this.selectGame(card.dataset.id);
        }
      });
    });
  }

  // ─── Fullscreen System ───────────────────────────────────────────────────

  setupFullscreen() {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFullscreen();
      });
    }
    
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
    document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
    
    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if (e.key === 'f' && this.currentGame) {
        this.toggleFullscreen();
      }
      if (e.key === 'Escape' && this.isFullscreen) {
        this.exitFullscreen();
      }
    });
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.enterFullscreen();
    } else {
      this.exitFullscreen();
    }
  }

  enterFullscreen() {
    const wrapper = document.getElementById('gamePlayerWrapper');
    if (!wrapper) return;
    
    if (wrapper.requestFullscreen) {
      wrapper.requestFullscreen();
    } else if (wrapper.webkitRequestFullscreen) {
      wrapper.webkitRequestFullscreen();
    } else if (wrapper.msRequestFullscreen) {
      wrapper.msRequestFullscreen();
    }
    
    wrapper.classList.add('fullscreen');
    this.isFullscreen = true;
    this.updateFullscreenIcon();
  }

  exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    
    const wrapper = document.getElementById('gamePlayerWrapper');
    if (wrapper) wrapper.classList.remove('fullscreen');
    this.isFullscreen = false;
    this.updateFullscreenIcon();
  }

  handleFullscreenChange() {
    const wrapper = document.getElementById('gamePlayerWrapper');
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (wrapper) wrapper.classList.remove('fullscreen');
      this.isFullscreen = false;
    } else {
      this.isFullscreen = true;
    }
    this.updateFullscreenIcon();
  }

  updateFullscreenIcon() {
    const icon = document.getElementById('fullscreenIcon');
    if (icon) {
      icon.innerHTML = this.isFullscreen 
        ? '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>'
        : '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
    }
  }

  // ─── Filtering ────────────────────────────────────────────────────────────

  applyFilters() {
    let list = this.allGames;

    // Category filter (sidebar)
    if (this.currentCategory !== 'all') {
      list = list.filter(g => this.categoryMatchesGame(g, this.currentCategory));
    }

    // Platform filter (top filter buttons)
    if (this.currentFilter === 'mobile') {
      list = list.filter(g => this.isMobileReady(g));
    } else if (this.currentFilter === 'desktop') {
      list = list.filter(g => this.isDesktopReady(g));
    }

    // Search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(g =>
        (g.title || '').toLowerCase().includes(q) ||
        this.getAllGenres(g).some(s => s.includes(q))
      );
    }

    this.games = list;
    this.renderGameCards(this.games);
  }

  // ─── Event Wiring ─────────────────────────────────────────────────────────

  setupSidebar() {
    document.querySelectorAll('.nav-item[data-category]').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        document.querySelectorAll('.nav-item[data-category]').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        this.currentCategory = item.dataset.category;
        const label = item.querySelector('.nav-label').textContent;
        document.getElementById('categoryTitle').textContent =
          this.currentCategory === 'all' ? 'All Games' : label + ' Games';
        // close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('active');
        this.showAllGames();
        this.applyFilters();
      });
    });
  }

  setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.applyFilters();
      });
    });
  }

  setupSearch() {
    const input = document.getElementById('searchInput');
    let debounceTimer;
    input.addEventListener('input', e => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchQuery = e.target.value.trim();
        this.applyFilters();
      }, 250);
    });
  }

  setupMobileMenu() {
    const toggle  = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  renderGameCards(games) {
    const grid = document.getElementById('gamesGrid');

    if (!games || games.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor" width="64" height="64">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <h3>No games found</h3>
          <p>Try a different search or category</p>
        </div>`;
      return;
    }

    grid.innerHTML = games.map(game => this.createGameCard(game)).join('');

    grid.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.game-card-fav')) {
          this.toggleFavorite(card.dataset.id, e);
        } else {
          this.selectGame(card.dataset.id);
        }
      });
    });
  }

  createGameCard(game) {
    const img     = this.getImage(game);
    const genre   = (game.genres && game.genres[0]) ? game.genres[0] : 'game';
    const hasMob  = this.isMobileReady(game);
    const isFav   = this.isFavorite(game.id);
    
    // Favorite heart icon
    const favHeart = `
      <div class="game-card-fav ${isFav ? 'active' : ''}" data-game-id="${game.id}">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </div>
    `;
    
    const badge   = hasMob
      ? `<span class="game-card-badge">mobile</span>`
      : '';
    const imgHTML = img
      ? `<img src="${img}" alt="${this.escHtml(game.title)}" class="game-card-image" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="game-card-image game-card-image--placeholder"></div>`;

    return `
      <div class="game-card" data-id="${game.id}">
        ${favHeart}
        ${badge}
        <div class="game-card-rating">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="#6842FF"><path d="M8 5v14l11-7z"/></svg>
          <span>Play</span>
        </div>
        ${imgHTML}
        <div class="game-card-overlay">
          <div class="game-card-title">${this.escHtml(game.title)}</div>
          <div class="game-card-category">${this.escHtml(genre)}</div>
        </div>
      </div>`;
  }

  selectGame(gameId) {
    const game = this.allGames.find(g => String(g.id) === String(gameId));
    if (!game) return;

    this.currentGame = game;

    // Show hero section
    const hero = document.getElementById('heroSection');
    hero.style.display = 'block';

    // Fill in info panel
    document.getElementById('currentGameTitle').textContent = game.title || 'Untitled';

    const playsEl = document.getElementById('currentGamePlays');
    playsEl.textContent = game.mobileReady ? game.mobileReady.join(' · ') : '';

    document.getElementById('currentGameDesc').textContent =
      (game.description || '').slice(0, 300) + ((game.description || '').length > 300 ? '…' : '');

    // Tags (genres)
    const tagsEl = document.getElementById('currentGameTags');
    const genres = (game.genres || []).slice(0, 5);
    tagsEl.innerHTML = genres.map(t => `<span class="tag">${this.escHtml(t)}</span>`).join('');

    // Platform badges
    const platEl = document.getElementById('currentGamePlatforms');
    platEl.innerHTML = (game.mobileReady || [])
      .map(p => `<span class="tag platform-tag">${this.escHtml(p)}</span>`)
      .join('');

    // Update favorite button state
    this.updateFavoriteButton();

    // Reset embed container, show overlay
    // FIXED: Use gameEmbedContainer instead of gameEmbedWrapper
    const container = document.getElementById('gameEmbedContainer');
    if (container) container.innerHTML = '';
    
    const overlay = document.getElementById('gameOverlay');
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <button class="play-button" id="playButton">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
        <span>PLAY NOW</span>
      </button>`;
    
    const playBtn = document.getElementById('playButton');
    if (playBtn) {
      playBtn.addEventListener('click', () => this.startGame());
    }

    // Scroll to game
    hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  startGame() {
    if (!this.currentGame) return;
    
    // FIXED: Use gameEmbedContainer instead of gameEmbedWrapper
    const container = document.getElementById('gameEmbedContainer');
    const overlay   = document.getElementById('gameOverlay');

    if (!container) {
      console.error('gameEmbedContainer not found!');
      return;
    }

    overlay.innerHTML = '<div class="loading-spinner"><span>Loading…</span></div>';

    if (this.currentGame.embed) {
      // Use the provided <iframe> embed string directly
      container.innerHTML = this.currentGame.embed;

      // Make the injected iframe fill the container
      const iframe = container.querySelector('iframe');
      if (iframe) {
        iframe.removeAttribute('width');
        iframe.removeAttribute('height');
        iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;';
        // allow fullscreen passthrough
        iframe.setAttribute('allowfullscreen', '');
      }
    } else {
      // Fallback: construct iframe from gameURL
      container.innerHTML = `
        <iframe
          src="${this.escHtml(this.currentGame.gameURL)}"
          style="position:absolute;inset:0;width:100%;height:100%;border:none;"
          allowfullscreen
          allow="fullscreen; accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        ></iframe>`;
    }

    // Hide overlay after a short delay (iframe load events are unreliable cross-origin)
    setTimeout(() => { overlay.style.display = 'none'; }, 1500);
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// Boot
document.addEventListener('DOMContentLoaded', () => { new GameHub(); });