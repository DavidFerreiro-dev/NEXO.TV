class NexoTVStreaming {
    constructor() {
        this.movies = [];
        this.filteredMovies = [];
        this.currentCategory = 'all';
        this.currentSort = 'default';
        this.currentMovie = null;
        // ¡IMPORTANTE! Asegúrate de que este nombre coincida con tu archivo JSON real
        this.jsonUrl = './movies.json';
        this.storageKey = 'nexo-tv-data';
        this.progressKey = 'nexo-tv-progress';
        this.favoritesKey = 'nexo-tv-favorites';
        this.cookieConsentKey = 'nexo-tv-cookie-consent';
        this.hudHideTimeout = null;
        this.hudHideDelay = 4000; // 4 segundos antes de ocultar los controles
        this.heroSlideInterval = null;
        this.currentHeroSlide = 0;
        
        this.stallCount = 0;
        this.stableMode = false;
        this.bufferInterval = null;
        this.lastSeekAt = 0; // timestamp of last user/programmatic seek

        // Detectar si es dispositivo móvil
        this.isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isSmallScreen = window.innerWidth <= 480;
        
            // Detectar TV y FireStick
            this.isTV = this.detectTVDevice();
            this.isFireStick = /Silk|AFTT|AFTM|AFTS|AFTB|AFTT|ARMv/.test(navigator.userAgent);
        
            // Variables para navegación remota
            this.focusableElements = [];
            this.currentFocusIndex = -1;
            this.remoteNavigationEnabled = this.isTV || this.isFireStick;
        
        // Variables para gestos touch
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.lastTapTime = 0;
        this.doubleTapDetected = false;

        this.isDragging = false;
        this.currentDragPercent = 0;

        this.initializeElements();
        this.setupEventListeners();
        this.loadMovies();
        this.initCookieConsent();
        this.initMobileLoader();
    }

    initializeElements() {
        // Contenedores principales
        this.moviesContainer = document.getElementById('moviesContainer');
        this.playerModal = document.getElementById('playerModal');

        // Inputs y Botones
        this.searchInput = document.getElementById('searchInput');
        if (this.searchInput) {
            this.searchInput.setAttribute('autocomplete', 'off');
        }
        this.sortSelect = document.getElementById('sortSelect');
        this.categoryBtns = document.querySelectorAll('.category-btn');
        this.closeBtn = document.getElementById('closeBtn');

        // Elementos del Reproductor
        this.videoPlayer = document.getElementById('videoPlayer');
        this.videoOverlay = document.getElementById('videoOverlay');
        // Eliminado centerPlayBtn
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.favBtn = document.getElementById('favBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.copyLinkBtn = document.getElementById('copyLinkBtn');
        this.progressBar = document.getElementById('progressBar');
        this.progressFilled = document.getElementById('progressFilled');
        this.progressTooltip = document.getElementById('progressTooltip');

        // Metadatos del Reproductor
        this.playerTitle = document.getElementById('playerTitle');
        this.playerSynopsis = document.getElementById('playerSynopsis');
        this.detailYear = document.getElementById('detailYear');
        this.detailCategory = document.getElementById('detailCategory');
        this.detailType = document.getElementById('detailType');

        // Elementos de Tiempo
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationEl = document.getElementById('duration');

        // Ficha Técnica
        this.sheetDirector = document.getElementById('sheetDirector');
        this.sheetCast = document.getElementById('sheetCast');
        this.sheetProducer = document.getElementById('sheetProducer');

        // Sección "Seguir Viendo"
        this.continueWatchingSection = document.getElementById('continueWatchingSection');
        this.continueWatchingContainer = document.getElementById('continueWatchingContainer');

        // Icono central animado (Estilo YouTube)
        this.centerIcon = document.createElement('div');
        this.centerIcon.className = 'center-icon-animation';
        const videoWrapper = document.querySelector('.video-wrapper');
        if (videoWrapper) videoWrapper.appendChild(this.centerIcon);

        // Lista de películas relacionadas
        this.relatedList = document.getElementById('relatedList');

        // Hero Slideshow
        this.heroSlidesContainer = document.getElementById('heroSlides');

        // Footer & Términos
        this.termsBtn = document.getElementById('termsBtn');
        this.termsModal = document.getElementById('termsModal');
        this.closeTermsBtn = document.getElementById('closeTermsBtn');

        // Download Modal
        this.downloadAppBtn = document.getElementById('downloadAppBtn');
        this.downloadModal = document.getElementById('downloadModal');
        this.closeDownloadBtn = document.getElementById('closeDownloadBtn');

        // Inyectar botón de Preferencias de Cookies en el footer (dinámicamente)
        if (this.termsBtn && this.termsBtn.parentNode && !this.isMobile) {
            if (!document.getElementById('cookiePrefsBtn')) {
                const cookieBtn = document.createElement('button');
                cookieBtn.id = 'cookiePrefsBtn';
                cookieBtn.className = 'footer-link-btn'; // Usa el estilo existente en CSS
                cookieBtn.textContent = 'Preferencias de Cookies';
                this.termsBtn.parentNode.insertBefore(cookieBtn, this.termsBtn.nextSibling);
                this.cookiePrefsBtn = cookieBtn;
            } else {
                this.cookiePrefsBtn = document.getElementById('cookiePrefsBtn');
            }
        }
    }

    setupEventListeners() {
        // Búsqueda
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.handleSearch(e));
        }

        // Ordenamiento
        if (this.sortSelect) {
            this.sortSelect.addEventListener('change', (e) => this.handleSortChange(e));
        }

        // Categorías
        this.categoryBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleCategoryChange(e));
        });

        // Cerrar Modal (Botón X)
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closePlayer());
        }

        // Cerrar Modal (Clic fuera)
        if (this.playerModal) {
            // Cerrar modal al hacer click fuera (DESACTIVADO por petición del usuario)
            /*
            this.playerModal.addEventListener('click', (e) => {
                if (e.target === this.playerModal) {
                    this.closePlayer();
                }
            });
            */
        }

        // Teclado (Escape para cerrar)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.playerModal.classList.contains('active')) {
                this.closePlayer();
            }
        });

        // === CONTROLES PERSONALIZADOS DEL VIDEO ===

        // Play/Pause - Botón de controles
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }

        // Click en el video para play/pause
        if (this.videoPlayer) {
            this.videoPlayer.addEventListener('click', () => {
                this.togglePlayPause();
                if (this.isMobile) this.animateCenterIcon();
            });
        }

        // Click en overlay para play/pause (cuando controles visibles)
        if (this.videoOverlay) {
            this.videoOverlay.addEventListener('click', (e) => {
                if (e.target === this.videoOverlay) {
                    this.togglePlayPause();
                    if (this.isMobile) this.animateCenterIcon();
                }
            });
        }

        // Mute/Unmute
        if (this.muteBtn) {
            this.muteBtn.addEventListener('click', () => this.toggleMute());
        }

        // Control de volumen
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => this.changeVolume(e.target.value));
        }

        // Pantalla completa
        if (this.fullscreenBtn) {
            this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Botón de Favoritos
        if (this.favBtn) {
            this.favBtn.addEventListener('click', () => this.toggleFavorite());
        }

        // Doble click para fullscreen
        if (this.videoPlayer) {
            this.videoPlayer.addEventListener('dblclick', () => this.toggleFullscreen());
        }

        // Listener para cambios de fullscreen (F11 o Esc)
        document.addEventListener('fullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('mozfullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('MSFullscreenChange', () => this.updateFullscreenButton());

        // Barra de progreso
        if (this.progressBar) {
            // Usamos el contenedor padre para tener mayor área táctil en móviles
            const progressArea = this.progressBar.parentElement || this.progressBar;

            // Iniciar arrastre (Mouse y Touch)
            progressArea.addEventListener('mousedown', (e) => this.startDrag(e));
            progressArea.addEventListener('touchstart', (e) => this.startDrag(e), { passive: false });

            // Arrastrar (Global)
            document.addEventListener('mousemove', (e) => this.onDrag(e));
            document.addEventListener('touchmove', (e) => this.onDrag(e), { passive: false });

            // Soltar (Global)
            document.addEventListener('mouseup', (e) => this.stopDrag(e));
            document.addEventListener('touchend', (e) => this.stopDrag(e));

            // Tooltip en Hover (Solo Desktop cuando no se arrastra)
            progressArea.addEventListener('mousemove', (e) => {
                if (!this.isDragging) this.updateTooltip(e);
            });
            progressArea.addEventListener('mouseleave', () => this.hideTooltip());
        }

        // Listeners de Video para tiempo y estado
        if (this.videoPlayer) {
            this.videoPlayer.addEventListener('timeupdate', () => {
                this.updateTime();
                this.updateProgressBar();
            });
            this.videoPlayer.addEventListener('loadedmetadata', () => this.updateDuration());
            this.videoPlayer.addEventListener('play', () => this.onVideoPlay());
            this.videoPlayer.addEventListener('pause', () => this.onVideoPause());
            this.videoPlayer.addEventListener('ended', () => this.onVideoEnded());

            // Eventos de carga
            this.videoPlayer.addEventListener('loadstart', () => this.resetBufferingStats());
            this.videoPlayer.addEventListener('waiting', () => this.handleBuffering());
            this.videoPlayer.addEventListener('canplay', () => this.hideLoading());
            this.videoPlayer.addEventListener('playing', () => this.hideLoading());
            this.videoPlayer.addEventListener('seeking', () => { 
                this.lastSeekAt = Date.now(); 
                this.showLoading();
            });

            // Manejo de errores
            this.videoPlayer.addEventListener('error', (e) => this.handleVideoError(e));
        }

        // Mostrar/ocultar controles en hover/touch
        if (this.videoOverlay) {
            const videoContainer = this.videoOverlay.parentElement;

            // Función para mostrar los controles
            const showControls = () => {
                this.videoOverlay.classList.add('show');
                videoContainer.style.cursor = 'default'; // Mostrar cursor
                clearTimeout(this.hudHideTimeout);

                // Programar ocultación solo si el video está en reproducción
                if (!this.videoPlayer.paused) {
                    this.hudHideTimeout = setTimeout(() => {
                        this.videoOverlay.classList.remove('show');
                        videoContainer.style.cursor = 'none'; // Ocultar cursor
                    }, this.hudHideDelay);
                }
            };

            // Event listeners para movimiento del ratón (solo desktop)
            if (!this.isMobile) {
                videoContainer.addEventListener('mousemove', showControls);
                videoContainer.addEventListener('mouseenter', showControls);
                videoContainer.addEventListener('mouseleave', () => {
                    if (!this.videoPlayer.paused) {
                        clearTimeout(this.hudHideTimeout);
                        this.hudHideTimeout = setTimeout(() => {
                            this.videoOverlay.classList.remove('show');
                            videoContainer.style.cursor = 'none';
                        }, this.hudHideDelay);
                    }
                });
            }

            // Mostrar controles cuando se pausa
            this.videoPlayer.addEventListener('pause', () => {
                clearTimeout(this.hudHideTimeout);
                this.videoOverlay.classList.add('show');
                videoContainer.style.cursor = 'default';
            });
            
            // Ocultar después de 4 segundos cuando se reanuda
            this.videoPlayer.addEventListener('play', () => {
                clearTimeout(this.hudHideTimeout);
                this.hudHideTimeout = setTimeout(() => {
                    this.videoOverlay.classList.remove('show');
                    videoContainer.style.cursor = 'none';
                }, this.hudHideDelay);
            });

            // Gestos touch mejorados para móviles
            if (this.isMobile) {
                videoContainer.addEventListener('touchstart', (e) => {
                    this.touchStartX = e.touches[0].clientX;
                    this.touchStartY = e.touches[0].clientY;
                    this.touchStartTime = Date.now();
                    showControls();
                }, { passive: true });

                videoContainer.addEventListener('touchend', () => {
                    const touchDuration = Date.now() - this.touchStartTime;
                    // Detectar doble tap (2 taps en menos de 500ms)
                    if (touchDuration < 200) {
                        const now = Date.now();
                        if (now - this.lastTapTime < 300) {
                            this.togglePlayPause();
                            this.doubleTapDetected = true;
                        }
                        this.lastTapTime = now;
                        
                        // Prevenir play/pause con simple tap si fue doble tap
                        if (this.doubleTapDetected) {
                            setTimeout(() => { this.doubleTapDetected = false; }, 300);
                            return;
                        }
                    }
                }, { passive: true });
            }
        }

        // Eventos Modal Términos
        if (this.termsBtn) {
            this.termsBtn.addEventListener('click', () => this.openTerms());
        }
        if (this.closeTermsBtn) {
            this.closeTermsBtn.addEventListener('click', () => this.closeTerms());
        }
        if (this.termsModal) {
            this.termsModal.addEventListener('click', (e) => {
                if (e.target === this.termsModal) this.closeTerms();
            });
        }

        // Eventos Modal Descarga
        if (this.downloadAppBtn) {
            this.downloadAppBtn.addEventListener('click', () => this.openDownloadModal());
        }
        if (this.closeDownloadBtn) {
            this.closeDownloadBtn.addEventListener('click', () => this.closeDownloadModal());
        }
        if (this.downloadModal) {
            this.downloadModal.addEventListener('click', (e) => {
                if (e.target === this.downloadModal) this.closeDownloadModal();
            });
        }

        if (this.copyLinkBtn) {
            this.copyLinkBtn.addEventListener('click', () => this.copyCurrentMovieLink());
        }

        window.addEventListener('popstate', () => this.handleRouteChange());

        // Botón Preferencias de Cookies
        if (this.cookiePrefsBtn) {
            this.cookiePrefsBtn.addEventListener('click', () => this.reopenCookieConsent());
        }

        // CONTROL POR TECLADO
        document.addEventListener('keydown', (e) => {
            if (!this.playerModal || !this.playerModal.classList.contains('active')) return;

            // Espacio: Play/Pause
            if (e.code === 'Space') {
                e.preventDefault(); // Evitar scroll
                this.togglePlayPause();
            }

            // Escape: Primero salir de fullscreen, luego cerrar modal
            if (e.code === 'Escape') {
                const videoWrapper = document.querySelector('.video-wrapper');
                if (videoWrapper && videoWrapper.classList.contains('is-fullscreen')) {
                    // Salir del fullscreen por fallback
                    videoWrapper.classList.remove('is-fullscreen');
                    if (this.fullscreenBtn) this.fullscreenBtn.querySelector('img').src = 'Assets/fullscreen.png';
                } else if (!document.fullscreenElement) {
                    this.closePlayer();
                    // También cerrar términos si está abierto
                    if (this.termsModal && this.termsModal.classList.contains('active')) {
                        this.closeTerms();
                    }
                    if (this.downloadModal && this.downloadModal.classList.contains('active')) {
                        this.closeDownloadModal();
                    }
                }
            }
        });
    }

    async loadMovies() {
        try {
            const response = await fetch(this.jsonUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            this.movies = await response.json();
            console.log(`✅ Cargadas ${this.movies.length} películas`);

            this.filterMovies();
            this.saveToStorage();
            this.initHeroSlideshow();
            
            // Iniciar detección de red
            this.initNetworkDetection();
            this.handleRouteChange();
        } catch (error) {
            console.error('❌ Error cargando películas:', error);
            this.moviesContainer.innerHTML = '<p class="error">Error al cargar el catálogo. Intente recargar la página.</p>';
            this.loadFromStorage();
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.movies));
        } catch (e) { console.warn('No se pudo guardar en localStorage'); }
    }

    loadFromStorage() {
        const data = localStorage.getItem(this.storageKey);
        if (data) {
            this.movies = JSON.parse(data);
            this.filterMovies();
            this.initHeroSlideshow();
            this.handleRouteChange();
        }
    }

    slugifyMovieTitle(title) {
        return String(title || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    getMoviePath(movie) {
        return `/${this.slugifyMovieTitle(movie.titulo)}`;
    }

    findMovieByCurrentPath(pathname = window.location.pathname) {
        const cleanPath = (decodeURIComponent(pathname || '/').replace(/\/+$/, '') || '/').toLowerCase();
        if (cleanPath === '/') return null;

        const routeSlug = cleanPath.slice(1);
        return this.movies.find(movie => this.slugifyMovieTitle(movie.titulo) === routeSlug) || null;
    }

    syncUrlWithMovie(movie, replace = false) {
        if (!movie) return;

        const moviePath = this.getMoviePath(movie);
        if (window.location.pathname === moviePath) return;

        const state = { movieId: movie.id };
        if (replace) {
            window.history.replaceState(state, '', moviePath);
        } else {
            window.history.pushState(state, '', moviePath);
        }
    }

    resetMovieUrl(replace = true) {
        if (window.location.pathname === '/') return;

        if (replace) {
            window.history.replaceState({}, '', '/');
        } else {
            window.history.pushState({}, '', '/');
        }
    }

    handleRouteChange() {
        if (!this.movies || this.movies.length === 0) return;

        const movieFromRoute = this.findMovieByCurrentPath();
        const isPlayerOpen = this.playerModal && this.playerModal.classList.contains('active');

        if (movieFromRoute) {
            if (!this.currentMovie || this.currentMovie.id !== movieFromRoute.id) {
                this.playMovie(movieFromRoute, { syncUrl: false });
            }
            return;
        }

        if (isPlayerOpen) {
            this.closePlayer({ syncUrl: false });
        }
    }

    getCurrentMovieShareLink() {
        if (!this.currentMovie) return window.location.href;
        return `${window.location.origin}${this.getMoviePath(this.currentMovie)}`;
    }

    async copyCurrentMovieLink() {
        if (!this.currentMovie) {
            this.showToast('⚠️ Abre una película primero.');
            return;
        }

        const link = this.getCurrentMovieShareLink();

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(link);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = link;
                textArea.setAttribute('readonly', '');
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }

            this.showToast('🔗 Enlace copiado al portapapeles.');
        } catch (error) {
            console.error('No se pudo copiar el enlace:', error);
            this.showToast('⚠️ No se pudo copiar el enlace.');
        }
    }

    filterMovies() {
        const term = this.searchInput ? this.searchInput.value.toLowerCase() : '';
        const favorites = this.getFavorites();

        this.filteredMovies = this.movies.filter(movie => {
            // Filtro Categoría
            let matchCat = (this.currentCategory === 'all') ||
                (this.currentCategory === 'essential' && movie.isEssential) ||
                (this.currentCategory === 'original' && movie.isOriginal) ||
                (this.currentCategory === 'favorites' && favorites.includes(movie.id));

            // Filtro Búsqueda (incluye título, sinopsis, director y reparto)
            let matchSearch = !term ||
                movie.titulo.toLowerCase().includes(term) ||
                (movie.sinopsis && movie.sinopsis.toLowerCase().includes(term)) ||
                (movie.director && movie.director.toLowerCase().includes(term)) ||
                (movie.cast && movie.cast.toLowerCase().includes(term));

            return matchCat && matchSearch;
        });

        // Aplicar ordenamiento
        if (this.currentSort === 'alpha') {
            this.filteredMovies.sort((a, b) => a.titulo.localeCompare(b.titulo));
        } else if (this.currentSort === 'date-desc') {
            this.filteredMovies.sort((a, b) => b.año - a.año);
        } else if (this.currentSort === 'date-asc') {
            this.filteredMovies.sort((a, b) => a.año - b.año);
        }
        // Si es 'default', no hacemos nada porque filteredMovies mantiene el orden relativo de this.movies (que es el del JSON)

        this.renderContinueWatching();
        this.render();
    }

    handleSearch() { this.filterMovies(); }

    handleSortChange(e) {
        this.currentSort = e.target.value;
        this.filterMovies();
    }

    handleCategoryChange(e) {
        this.categoryBtns.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        this.currentCategory = e.target.dataset.category;
        this.filterMovies();
    }

    updateTime() {
        let currentTime = 0;
        if (this.videoPlayer) {
            currentTime = this.videoPlayer.currentTime;
        }

        if (this.currentTimeEl) {
            this.currentTimeEl.textContent = this.formatTime(currentTime);

            // Guardar progreso cada segundo (evita guardar en cada milisegundo)
            if (Math.floor(currentTime) !== this.lastSavedSecond) {
                this.saveProgress();
                this.lastSavedSecond = Math.floor(currentTime);
            }
        }
    }

    updateDuration() {
        let duration = 0;
        if (this.videoPlayer) {
            duration = this.videoPlayer.duration;
        }
        
        if (this.durationEl) {
            this.durationEl.textContent = this.formatTime(isNaN(duration) ? 0 : duration);
        }
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // === MÉTODOS DE CONTROL DEL REPRODUCTOR ===

    togglePlayPause() {
        if (!this.videoPlayer) return;
        if (this.videoPlayer.paused) {
            this.videoPlayer.play();
        } else {
            this.videoPlayer.pause();
        }
    }

    onVideoPlay() {
        if (this.playPauseBtn) this.playPauseBtn.querySelector('img').src = 'Assets/pause.png';
        if (this.centerPlayBtn) this.centerPlayBtn.classList.add('playing');
        if (this.videoOverlay) this.videoOverlay.classList.add('show');
    }

    onVideoPause() {
        if (this.playPauseBtn) this.playPauseBtn.querySelector('img').src = 'Assets/play.png';
        if (this.centerPlayBtn) this.centerPlayBtn.classList.remove('playing');
        if (this.videoOverlay) this.videoOverlay.classList.add('show');
    }

    onVideoEnded() {
        if (this.playPauseBtn) this.playPauseBtn.querySelector('img').src = 'Assets/play.png';
        if (this.centerPlayBtn) this.centerPlayBtn.classList.remove('playing');
        if (this.videoOverlay) this.videoOverlay.classList.add('show');
        // Resetear progreso
        if (this.progressFilled) this.progressFilled.style.width = '0%';
    }

    toggleMute() {
        if (this.videoPlayer) {
            this.videoPlayer.muted = !this.videoPlayer.muted;
        }
        this.updateMuteButton();
    }

    updateMuteButton() {
        if (!this.muteBtn || !this.videoPlayer) return;

        const img = this.muteBtn.querySelector('img');
        let isMuted = false;

        if (this.videoPlayer) {
            isMuted = this.videoPlayer.muted || this.videoPlayer.volume === 0;
        }

        if (isMuted) {
            if (img) img.src = 'Assets/volumeOff.png';
        } else {
            if (img) img.src = 'Assets/volumeOn.png';
        }
    }

    changeVolume(value) {
        if (this.videoPlayer) {
            this.videoPlayer.volume = value / 100;
            this.videoPlayer.muted = false;
        }
        this.updateMuteButton();
    }

    toggleFullscreen() {
        const videoWrapper = document.querySelector('.video-wrapper');
        if (!videoWrapper) return;

        const isFullscreen = document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement ||
            videoWrapper.classList.contains('is-fullscreen');

        if (!isFullscreen) {
            // Intentar Fullscreen API
            const fsPromise = videoWrapper.requestFullscreen ? videoWrapper.requestFullscreen() :
                videoWrapper.webkitRequestFullscreen ? videoWrapper.webkitRequestFullscreen() :
                    videoWrapper.msRequestFullscreen ? videoWrapper.msRequestFullscreen() :
                        null;

            if (fsPromise) {
                fsPromise.then(() => {
                    // En móviles, forzar orientación landscape DESPUÉS de entrar en fullscreen
                    if (this.isMobile && screen.orientation && screen.orientation.lock) {
                        screen.orientation.lock('landscape').catch(console.warn);
                    }
                }).catch(() => {
                    videoWrapper.classList.add('is-fullscreen');
                    document.body.style.overflow = 'hidden';
                });
            } else {
                // API no disponible, usar fallback
                videoWrapper.classList.add('is-fullscreen');
                document.body.style.overflow = 'hidden';
            }

            if (this.fullscreenBtn) this.fullscreenBtn.querySelector('img').src = 'Assets/minimize.png';
        } else {
            // Salir de fullscreen
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else if (document.webkitFullscreenElement) {
                document.webkitExitFullscreen();
            } else if (document.msFullscreenElement) {
                document.msExitFullscreen();
            }

            // Liberar la orientación en móviles
            if (this.isMobile && screen.orientation && screen.orientation.unlock) {
                try {
                    screen.orientation.unlock();
                } catch (e) {
                    console.log('No se pudo desbloquear orientación');
                }
            }

            // Siempre quitar la clase de fallback
            videoWrapper.classList.remove('is-fullscreen');

            if (this.fullscreenBtn) this.fullscreenBtn.querySelector('img').src = 'Assets/fullscreen.png';
        }
    }

    animateCenterIcon() {
        if (!this.centerIcon) return;
        
        let isPlaying = false;
        isPlaying = !this.videoPlayer.paused;

        // Icono a mostrar: Si está play, mostramos play. Si pausa, pausa.
        const iconSrc = isPlaying ? 'Assets/play.png' : 'Assets/pause.png';
        
        this.centerIcon.innerHTML = `<img src="${iconSrc}">`;
        
        // Reiniciar animación
        this.centerIcon.classList.remove('active');
        void this.centerIcon.offsetWidth; // Trigger reflow
        this.centerIcon.classList.add('active');
        
        setTimeout(() => {
            this.centerIcon.classList.remove('active');
        }, 600);
    }

    updateFullscreenButton() {
        // Esta función se llama cuando cambia el estado de fullscreen
        const videoWrapper = document.querySelector('.video-wrapper');
        if (!videoWrapper) return;

        const isFullscreen = document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement ||
            videoWrapper.classList.contains('is-fullscreen');

        if (this.fullscreenBtn && this.fullscreenBtn.querySelector('img')) {
            this.fullscreenBtn.querySelector('img').src = isFullscreen ? 'Assets/minimize.png' : 'Assets/fullscreen.png';
        }
    }

    updateProgressBar() {
        if (!this.progressFilled || this.isDragging) return;

        let current = 0;
        let duration = 0;

        if (this.videoPlayer) {
            current = this.videoPlayer.currentTime;
            duration = this.videoPlayer.duration;
        }

        if (duration <= 0) return;
        const percent = (current / duration) * 100;
        this.progressFilled.style.width = `${percent}%`;
    }

    updateTooltip(e) {
        if (!this.progressTooltip || !this.videoPlayer || !this.progressBar) return;
        
        // Prevenir scroll en móviles al tocar la barra
        if (e.type === 'touchmove' || e.type === 'touchstart') {
            e.preventDefault();
        }

        const rect = this.progressBar.getBoundingClientRect();
        let clientX = e.clientX;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
        }

        let percent = (clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));

        const duration = this.videoPlayer.duration || 0;
        const previewTime = percent * duration;

        this.progressTooltip.textContent = this.formatTime(previewTime);

        this.progressTooltip.style.left = `${percent * 100}%`;
        this.progressTooltip.classList.add('show');
    }

    hideTooltip() {
        if (this.progressTooltip) {
            this.progressTooltip.classList.remove('show');
        }
    }

    startDrag(e) {
        this.isDragging = true;
        this.onDrag(e);
    }

    onDrag(e) {
        if (!this.isDragging) return;

        if (e.type === 'touchmove' || e.type === 'touchstart') {
            e.preventDefault();
        }

        const rect = this.progressBar.getBoundingClientRect();
        let clientX = e.clientX;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
        }

        let percent = (clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));

        this.currentDragPercent = percent;

        if (this.progressFilled) {
            this.progressFilled.style.width = `${percent * 100}%`;
        }

        if (this.progressTooltip && this.videoPlayer) {
            const duration = this.videoPlayer.duration || 0;
            const previewTime = percent * duration;
            this.progressTooltip.textContent = this.formatTime(previewTime);
            this.progressTooltip.style.left = `${percent * 100}%`;
            this.progressTooltip.classList.add('show');
        }
    }

    stopDrag(e) {
        if (!this.isDragging) return;
        this.isDragging = false;

        if (this.videoPlayer && isFinite(this.videoPlayer.duration)) {
            this.lastSeekAt = Date.now();
            this.videoPlayer.currentTime = this.currentDragPercent * this.videoPlayer.duration;
        }

        this.hideTooltip();
    }

    // === GESTIÓN DE CARGA Y ERRORES ===

    initNetworkDetection() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            const checkConnection = () => {
                const type = connection.effectiveType;
                // Si es 2g, 3g o tiene saveData activado
                if (type === '2g' || type === '3g' || type === 'slow-2g' || connection.saveData) {
                    console.log(`📡 Conexión lenta detectada (${type}). Activando Modo Estable.`);
                    this.activateStableMode();
                }
            };
            checkConnection();
            connection.addEventListener('change', checkConnection);
        }
    }

    activateStableMode() {
        if (this.stableMode) return;
        this.stableMode = true;
        this.showToast('📡 Modo de Conexión Lenta activado. Optimizando búfer...');
    }

    resetBufferingStats() {
        this.stallCount = 0;
        if (this.bufferInterval) clearInterval(this.bufferInterval);
    }

    handleBuffering() {
        // Ignorar buffering inmediato si proviene de un seek del usuario o del propio reproductor
        const sinceSeek = Date.now() - (this.lastSeekAt || 0);
        if (this.videoPlayer && (this.videoPlayer.seeking || sinceSeek < 1200)) {
            return; // No tratar esto como un fallo de conexión
        }

        this.showLoading();
    }

    showLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.add('active');
            const span = this.loadingOverlay.querySelector('span');
            if (span) {
                span.textContent = 'CARGANDO';
                span.style.color = ''; // Resetear color (quitar rojo de error)
            }
            const spinner = this.loadingOverlay.querySelector('.spinner');
            if (spinner) spinner.style.display = ''; // Asegurar que el spinner se muestra
        }
    }

    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.remove('active');
            if (this.bufferInterval) clearInterval(this.bufferInterval);
        }
    }

    handleVideoError(e) {
        console.error('Error de video:', this.videoPlayer.error);
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.add('active');
            const span = this.loadingOverlay.querySelector('span');
            if (span) {
                // Mensaje de error amigable, manteniendo el estilo de carga
                span.textContent = 'ERROR AL CARGAR VIDEO';
                span.style.color = '#ff4444'; // Rojo para error
            }
            const spinner = this.loadingOverlay.querySelector('.spinner');
            if (spinner) spinner.style.display = 'none'; // Ocultar spinner en error
        }
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        // Forzar reflow para animación
        toast.offsetHeight;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    // === GESTIÓN DE COOKIES Y PRIVACIDAD ===
    initCookieConsent() {
        // En móviles, aceptamos automáticamente y no mostramos el banner
        if (this.isMobile) {
            if (localStorage.getItem(this.cookieConsentKey) !== 'accepted') {
                localStorage.setItem(this.cookieConsentKey, 'accepted');
            }
            return;
        }

        if (!localStorage.getItem(this.cookieConsentKey)) {
            this.createCookieBanner();
            setTimeout(() => {
                const banner = document.getElementById('cookieConsent');
                if (banner) banner.classList.add('show');
            }, 1000);
        }
    }

    createCookieBanner() {
        if (document.getElementById('cookieConsent')) return; // Evitar duplicados
        const banner = document.createElement('div');
        banner.id = 'cookieConsent';
        banner.className = 'cookie-consent';
        banner.innerHTML = `
            <div class="cookie-content">
                <div class="cookie-text">
                    <h3>🍪 Preferencias de Almacenamiento</h3>
                    <p>Utilizamos almacenamiento local para guardar tu progreso en las películas y tus favoritos. ¿Aceptas que guardemos estos datos?</p>
                </div>
                <div class="cookie-buttons">
                    <button id="cookieRejectBtn" class="btn-cookie-reject">Rechazar</button>
                    <button id="cookieTermsBtn" class="btn-cookie-terms">Leer Términos</button>
                    <button id="cookieAcceptBtn" class="btn-cookie-accept">Aceptar</button>
                </div>
            </div>
        `;
        document.body.appendChild(banner);

        document.getElementById('cookieAcceptBtn').addEventListener('click', () => this.handleCookieChoice('accepted'));
        document.getElementById('cookieRejectBtn').addEventListener('click', () => this.handleCookieChoice('rejected'));
        document.getElementById('cookieTermsBtn').addEventListener('click', () => this.openTerms());
    }

    reopenCookieConsent() {
        this.createCookieBanner();
        // Pequeño delay para permitir la transición CSS
        setTimeout(() => {
            const banner = document.getElementById('cookieConsent');
            if (banner) banner.classList.add('show');
        }, 100);
    }

    handleCookieChoice(choice) {
        localStorage.setItem(this.cookieConsentKey, choice);
        const banner = document.getElementById('cookieConsent');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 500);
        }
        
        if (choice === 'accepted') {
            this.showToast('✅ Preferencias guardadas. ¡Disfruta de NEXO.TV!');
            this.renderContinueWatching(); // Actualizar interfaz
        } else {
            this.showToast('⚠️ Has rechazado las cookies. No se guardará tu progreso.');
            this.renderContinueWatching(); // Ocultar sección si estaba visible
        }
    }

    hasCookieConsent() {
        return localStorage.getItem(this.cookieConsentKey) === 'accepted';
    }

    // Gestión de Progreso
    saveProgress() {
        if (!this.currentMovie || !this.videoPlayer) return;
        
        const data = JSON.parse(localStorage.getItem(this.progressKey)) || {};
        
        data[this.currentMovie.id] = this.videoPlayer.currentTime;
        
        localStorage.setItem(this.progressKey, JSON.stringify(data));
    }

    getSavedProgress(id) {
        if (!this.hasCookieConsent()) return 0;
        const data = JSON.parse(localStorage.getItem(this.progressKey)) || {};
        return data[id] || 0;
    }

    // Helper para convertir enlaces de Google Drive a directos
    getDirectUrl(url) {
        if (url && url.includes('drive.google.com')) {
            const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
            if (idMatch && idMatch[1]) {
                return `https://drive.google.com/uc?export=download&confirm=no_antivirus&id=${idMatch[1]}`;
            }
        }
        return url;
    }

    renderContinueWatching() {
        if (!this.continueWatchingContainer || !this.continueWatchingSection) return;

        if (!this.hasCookieConsent()) {
            this.continueWatchingSection.style.display = 'none';
            return;
        }

        // No mostrar "Seguir Viendo" si está en categorías especiales
        if (this.currentCategory !== 'all') {
            this.continueWatchingSection.style.display = 'none';
            return;
        }

        const progressData = JSON.parse(localStorage.getItem(this.progressKey)) || {};
        const moviesWithProgress = [];

        // Obtener películas con progreso
        for (const movieId in progressData) {
            const progress = progressData[movieId];
            const movie = this.movies.find(m => m.id == movieId);
            
            if (movie && progress > 0) {
                moviesWithProgress.push({ movie, progress });
            }
        }

        // Mostrar/ocultar sección
        if (moviesWithProgress.length === 0) {
            this.continueWatchingSection.style.display = 'none';
            return;
        }

        this.continueWatchingSection.style.display = 'block';
        this.continueWatchingContainer.innerHTML = '';

        // Renderizar películas
        moviesWithProgress.forEach(({ movie, progress }) => {
            const card = document.createElement('div');
            card.className = 'continue-item';

            card.innerHTML = `
                <div style="position: relative;">
                    <img src="${movie.poster}" alt="${movie.titulo}" class="movie-poster" loading="lazy">
                    <div class="continue-progress">
                        <div class="continue-progress-bar" data-movie-id="${movie.id}" style="width: 0%"></div>
                    </div>
                    <button class="continue-remove-btn" title="Eliminar del historial">×</button>
                </div>
            `;

            // Actualizar barra de progreso cuando se carga el video
            const tempVideo = document.createElement('video');
            tempVideo.src = this.getDirectUrl(movie.videoUrl);
            tempVideo.addEventListener('loadedmetadata', () => {
                const progressPercent = (progress / tempVideo.duration) * 100;
                const progressBar = card.querySelector('.continue-progress-bar');
                if (progressBar) progressBar.style.width = Math.min(progressPercent, 95) + '%';
            });

            const removeBtn = card.querySelector('.continue-remove-btn');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFromContinueWatching(movie.id);
            });

            card.addEventListener('click', () => this.playMovie(movie));
            this.continueWatchingContainer.appendChild(card);
        });
    }

    removeFromContinueWatching(movieId) {
        if (!this.hasCookieConsent()) return;
        const progressData = JSON.parse(localStorage.getItem(this.progressKey)) || {};
        delete progressData[movieId];
        localStorage.setItem(this.progressKey, JSON.stringify(progressData));
        this.renderContinueWatching(); // Renderizar nuevamente
    }

    render() {
        if (!this.moviesContainer) return;
        this.moviesContainer.innerHTML = '';

        if (this.filteredMovies.length === 0) {
            this.moviesContainer.innerHTML = '<p class="no-results">No se encontraron películas.</p>';
            return;
        }

        this.filteredMovies.forEach(movie => {
            const card = document.createElement('div');
            card.className = `movie-card ${movie.isOriginal ? 'original-border' : ''}`;

            let badges = '';
            if (movie.isEssential) badges += '<span class="badge badge-essential">ESSENTIAL</span>';
            if (movie.isOriginal) badges += '<span class="badge badge-original">ORIGINAL</span>';

            card.innerHTML = `
                <div style="position: relative;">
                    <img src="${movie.poster}" alt="${movie.titulo}" class="movie-poster" loading="lazy">
                    <button class="play-button"><img src="Assets/play.png" alt="Play"></button>
                </div>
                <div class="movie-info">
                    <h3 class="movie-title">${movie.titulo}</h3>
                    <p class="movie-year">${movie.año} ${badges}</p>
                </div>
            `;

            card.addEventListener('click', () => this.playMovie(movie));
            this.moviesContainer.appendChild(card);
        });
    }

    // ==========================================
    //  SECCIÓN DEL REPRODUCTOR ARREGLADA
    // ==========================================
    async playMovie(movie, options = {}) {
        const { syncUrl = true } = options;
        this.currentMovie = movie;

        // 1. Llenar textos
        if (this.playerTitle) this.playerTitle.textContent = movie.titulo;
        if (this.playerSynopsis) this.playerSynopsis.textContent = movie.sinopsis;
        if (this.detailYear) this.detailYear.textContent = movie.año;
        if (this.detailCategory) this.detailCategory.textContent = movie.categoria || 'General';

        let type = 'Estándar';
        if (movie.isEssential) type = 'Essential Masterpiece';
        if (movie.isOriginal) type = 'NEXO Original';
        if (this.detailType) this.detailType.textContent = type;

        // 2. Configurar el Video (LA PARTE CLAVE)
        if (this.videoPlayer) {
            // Reseteamos el reproductor
            this.videoPlayer.pause();
            if (this.currentTimeEl) this.currentTimeEl.textContent = "0:00";
            if (this.durationEl) this.durationEl.textContent = "0:00";

            // A) ASIGNAR PÓSTER: Esto hace que la imagen se vea antes de dar play
            this.videoPlayer.poster = movie.poster;

            // B) ASIGNAR VIDEO DIRECTAMENTE: Es más seguro que usar <source>
            
            let videoSrc = this.getDirectUrl(movie.videoUrl);
            
            this.videoPlayer.src = videoSrc;

            // C) Cargar
            this.videoPlayer.load();

            // D) Restaurar progreso si existe
            const savedTime = this.getSavedProgress(movie.id);
            if (savedTime > 0) {
                this.lastSeekAt = Date.now();
                this.videoPlayer.currentTime = savedTime;
            }

            // E) Resetear controles personalizados
            if (this.playPauseBtn) this.playPauseBtn.querySelector('img').src = 'Assets/play.png';
            if (this.centerPlayBtn) this.centerPlayBtn.classList.remove('playing');
            if (this.progressFilled) this.progressFilled.style.width = '0%';
            if (this.videoOverlay) this.videoOverlay.classList.add('show');
            this.stallCount = 0; // Resetear contador al terminar

            // F) Intentar reproducir suavemente
            const playPromise = this.videoPlayer.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    console.log('Autoplay bloqueado por el navegador. El usuario debe pulsar play.');
                    // No pasa nada, los controles nativos mostrarán el botón de play gigante.
                });
            }
        }

        // 3. Cargar ficha técnica, películas relacionadas y mostrar modal
        this.loadTechnicalSheet(movie);
        this.loadRelatedMovies(movie);
        this.updateFavoriteButton();
        if (this.playerModal) this.playerModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        if (syncUrl) {
            this.syncUrlWithMovie(movie);
        }
    }

    closePlayer(options = {}) {
        const { syncUrl = true } = options;

        if (this.playerModal) this.playerModal.classList.remove('active');
        document.body.style.overflow = 'auto';

        // Limpiar el timeout del HUD
        clearTimeout(this.hudHideTimeout);

        // Limpiar el reproductor para que deje de descargar datos
        if (this.videoPlayer) {
            this.videoPlayer.pause();
            this.videoPlayer.currentTime = 0;
            this.videoPlayer.removeAttribute('src'); // Elimina la fuente completamente
            this.videoPlayer.load();
        }

        this.currentMovie = null;

        if (syncUrl) {
            this.resetMovieUrl(true);
        }
    }

    // ==========================================
    //  GESTIÓN DE FAVORITOS
    // ==========================================
    toggleFavorite() {
        if (!this.currentMovie) return;

        if (!this.hasCookieConsent()) {
            this.showToast('⚠️ Acepta las cookies para guardar favoritos.');
            return;
        }

        const favorites = this.getFavorites();
        const isFavorite = favorites.includes(this.currentMovie.id);

        if (isFavorite) {
            // Remover de favoritos
            const index = favorites.indexOf(this.currentMovie.id);
            favorites.splice(index, 1);
        } else {
            // Agregar a favoritos
            favorites.push(this.currentMovie.id);
        }

        localStorage.setItem(this.favoritesKey, JSON.stringify(favorites));
        this.updateFavoriteButton();
    }

    getFavorites() {
        if (!this.hasCookieConsent()) return [];
        const data = localStorage.getItem(this.favoritesKey);
        return data ? JSON.parse(data) : [];
    }

    isFavorite(movieId) {
        return this.getFavorites().includes(movieId);
    }

    updateFavoriteButton() {
        if (!this.favBtn || !this.currentMovie) return;

        if (this.isFavorite(this.currentMovie.id)) {
            this.favBtn.classList.add('favorite');
        } else {
            this.favBtn.classList.remove('favorite');
        }
    }

    loadTechnicalSheet(movie) {
        console.log('📋 Cargando ficha técnica para:', movie.titulo);

        // Buscar los elementos dinámicamente en caso de que no estén inicializados
        const sheetDirector = document.getElementById('sheetDirector');
        const sheetCast = document.getElementById('sheetCast');
        const sheetProducer = document.getElementById('sheetProducer');

        // Director(es)
        if (sheetDirector && movie.director) {
            const directors = movie.director.split(',').map(d => d.trim());
            const directorElements = directors.map(dir => 
                `<span class="sheet-clickable" data-search="${dir}">${dir}</span>`
            );
            sheetDirector.innerHTML = directorElements.join(', ');
            
            // Agregar event listeners
            sheetDirector.querySelectorAll('.sheet-clickable').forEach(el => {
                el.addEventListener('click', () => this.searchByPerson(el.dataset.search));
            });
        }

        // Reparto
        if (sheetCast && movie.cast) {
            const actors = movie.cast.split(',').map(a => a.trim());
            const actorElements = actors.map(actor => 
                `<span class="sheet-clickable" data-search="${actor}">${actor}</span>`
            );
            sheetCast.innerHTML = actorElements.join(', ');
            
            // Agregar event listeners
            sheetCast.querySelectorAll('.sheet-clickable').forEach(el => {
                el.addEventListener('click', () => this.searchByPerson(el.dataset.search));
            });
        }

        // Productora
        if (sheetProducer && movie.producer) {
            sheetProducer.textContent = movie.producer;
        }
    }

    loadRelatedMovies(current) {
        const relatedList = document.getElementById('relatedList');
        if (!relatedList) return;
        relatedList.innerHTML = '';

        // Filtrar películas diferentes a la actual y mezclarlas aleatoriamente
        const availableMovies = this.movies.filter(m => m.id !== current.id);
        const shuffled = availableMovies.sort(() => Math.random() - 0.5);
        const related = shuffled.slice(0, 5);

        related.forEach(m => {
            const el = document.createElement('div');
            el.className = 'related-item';
            el.innerHTML = `<img src="${m.poster}" alt="${m.titulo}"><span>${m.titulo}</span>`;
            el.addEventListener('click', () => this.playMovie(m));
            relatedList.appendChild(el);
        });
    }

    searchByPerson(personName) {
        // Buscar por director/actor
        if (this.searchInput) {
            this.searchInput.value = personName;
            this.handleSearch();
            // Scroll a la sección de catálogo
            document.querySelector('.catalog-section').scrollIntoView({ behavior: 'smooth' });
        }
    }

    initHeroSlideshow() {
        if (!this.heroSlidesContainer || this.movies.length === 0) return;

        // Filtrar películas que tengan landscape
        const slides = this.movies.filter(m => m.landscape);
        
        // Si no hay suficientes, usar posters o lo que haya
        if (slides.length === 0) return;

        // Limpiar contenedor
        this.heroSlidesContainer.innerHTML = '';

        // Crear elementos de imagen
        slides.forEach((movie, index) => {
            const img = document.createElement('img');
            img.src = movie.landscape;
            img.alt = `Slide ${movie.titulo}`;
            img.className = `hero-slide ${index === 0 ? 'active' : ''}`;
            this.heroSlidesContainer.appendChild(img);
        });

        // Iniciar intervalo
        if (this.heroSlideInterval) clearInterval(this.heroSlideInterval);
        
        const slideElements = this.heroSlidesContainer.querySelectorAll('.hero-slide');
        
        this.heroSlideInterval = setInterval(() => {
            slideElements[this.currentHeroSlide].classList.remove('active');
            this.currentHeroSlide = (this.currentHeroSlide + 1) % slideElements.length;
            slideElements[this.currentHeroSlide].classList.add('active');
        }, 5000); // Cambiar cada 5 segundos
    }

    openTerms() {
        if (this.termsModal) this.termsModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeTerms() {
        if (this.termsModal) this.termsModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    openDownloadModal() {
        if (this.downloadModal) this.downloadModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeDownloadModal() {
        if (this.downloadModal) this.downloadModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    initMobileLoader() {
        // Pantalla de carga para todos los dispositivos (móvil, tablet y PC)
        const loader = document.getElementById('mobileLoader');
        if (loader) {
            // Mostrar loader
            loader.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            const hideLoader = () => {
                loader.style.transition = 'opacity 0.5s ease';
                loader.style.opacity = '0';
                setTimeout(() => {
                    loader.style.display = 'none';
                    document.body.style.overflow = '';
                }, 500);
            };

            // Timeout de seguridad (20s)
            const safetyTimeout = setTimeout(() => {
                hideLoader();
            }, 20000);

            // Evento de carga completa
            if (document.readyState === 'complete') {
                clearTimeout(safetyTimeout);
                hideLoader();
            } else {
                window.addEventListener('load', () => {
                    clearTimeout(safetyTimeout);
                    hideLoader();
                });
            }
        }
    }

    // ==================== TV & FireStick SUPPORT METHODS ====================

    detectTVDevice() {
        const ua = navigator.userAgent || '';
        
        // Detectar FireStick y dispositivos Amazon
        if (/Silk|AFTT|AFTM|AFTS|AFTB|ARMv/.test(ua)) {
            return true;
        }
        
        // Detectar Android TV
        if (/Android.*TV|GoogleTV|NETCAST|SmartTV|WebOS|Tizen/.test(ua)) {
            return true;
        }
        
        // Detectar por resolución (TVs suelen ser muy grandes)
        if (window.innerWidth >= 1920 && window.innerHeight >= 1080) {
            // Pero descartar si parece ser una ventana de navegador grande en desktop
            if (!/Windows|Macintosh|Linux x86/.test(ua) || window.devicePixelRatio < 1.5) {
                // Si es una resolución 4K o 1080p landscape, probablemente es TV
                if (Math.min(window.innerWidth, window.innerHeight) >= 1080) {
                    return true;
                }
            }
        }
        
        return false;
    }

    initRemoteNavigation() {
        console.log('🎮 Inicializando navegación por control remoto (TV/FireStick)');
        
        // Escuchar teclas de navegación
        document.addEventListener('keydown', (e) => this.handleRemoteKeyPress(e));
        
        // Al cargar las películas, compilar lista de elementos enfocables
        setTimeout(() => this.updateFocusableElements(), 500);
    }

    updateFocusableElements() {
        // Elementos que pueden recibir foco: botones, inputs, tarjetas de película
        this.focusableElements = Array.from(document.querySelectorAll(
            'button:not(:disabled), input, select, .category-btn, .movie-card, .footer-link-btn'
        )).filter(el => {
            // Excluir elementos ocultos
            return el.offsetParent !== null && el.style.display !== 'none';
        });

        // Si hay elementos, enfocar el primero
        if (this.focusableElements.length > 0 && this.currentFocusIndex === -1) {
            this.currentFocusIndex = 0;
            this.focusElement(this.currentFocusIndex);
        }
    }

    handleRemoteKeyPress(e) {
        // Si estamos en player modal, usar controles de video
        if (this.playerModal && this.playerModal.classList.contains('active')) {
            this.handlePlayerKeyPress(e);
            return;
        }

        switch(e.key) {
            case 'ArrowUp':
                e.preventDefault();
                this.navigateFocus(-1, 'vertical');
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.navigateFocus(1, 'vertical');
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.navigateFocus(-1, 'horizontal');
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.navigateFocus(1, 'horizontal');
                break;
            case 'Enter':
                e.preventDefault();
                this.activateFocus();
                break;
            case 'Backspace':
                e.preventDefault();
                this.showToast('Presiona Escape para salir');
                break;
        }
    }

    handlePlayerKeyPress(e) {
        // Controles especiales en el reproductor de video
        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                // Retroceder 10 segundos
                if (this.videoPlayer) {
                    this.videoPlayer.currentTime = Math.max(0, this.videoPlayer.currentTime - 10);
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                // Avanzar 10 segundos
                if (this.videoPlayer) {
                    this.videoPlayer.currentTime = Math.min(this.videoPlayer.duration, this.videoPlayer.currentTime + 10);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                // Aumentar volumen 10%
                if (this.videoPlayer) {
                    this.videoPlayer.volume = Math.min(1, this.videoPlayer.volume + 0.1);
                    if (this.volumeSlider) this.volumeSlider.value = this.videoPlayer.volume * 100;
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                // Disminuir volumen 10%
                if (this.videoPlayer) {
                    this.videoPlayer.volume = Math.max(0, this.videoPlayer.volume - 0.1);
                    if (this.volumeSlider) this.volumeSlider.value = this.videoPlayer.volume * 100;
                }
                break;
            case ' ':
            case 'Enter':
                e.preventDefault();
                this.togglePlayPause();
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                this.toggleFullscreen();
                break;
        }
    }

    navigateFocus(direction, axis = 'vertical') {
        if (this.focusableElements.length === 0) {
            this.updateFocusableElements();
            return;
        }

        if (this.currentFocusIndex === -1) {
            this.currentFocusIndex = 0;
        } else {
            this.currentFocusIndex = (this.currentFocusIndex + direction + this.focusableElements.length) % this.focusableElements.length;
        }

        this.focusElement(this.currentFocusIndex);
    }

    focusElement(index) {
        // Remover foco anterior
        this.focusableElements.forEach(el => el.blur());

        if (index >= 0 && index < this.focusableElements.length) {
            const element = this.focusableElements[index];
            element.focus({ behavior: 'smooth' });

            // Scroll suave hacia el elemento si es necesario
            setTimeout(() => {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
        }
    }

    activateFocus() {
        if (this.currentFocusIndex >= 0 && this.currentFocusIndex < this.focusableElements.length) {
            const element = this.focusableElements[this.currentFocusIndex];
            
            // Simular click
            element.click();
            
            // Si es un input, enfocar para escritura
            if (element.tagName === 'INPUT') {
                element.focus();
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new NexoTVStreaming();
});