class NexoTVStreaming {
    constructor() {
        this.movies = [];
        this.filteredMovies = [];
        this.currentCategory = 'all';
        this.currentMovie = null;
        // ¡IMPORTANTE! Asegúrate de que este nombre coincida con tu archivo JSON real
        this.jsonUrl = './movies.json';
        this.storageKey = 'nexo-tv-data';
        this.progressKey = 'nexo-tv-progress';
        this.favoritesKey = 'nexo-tv-favorites';
        this.hudHideTimeout = null;
        this.hudHideDelay = 4000; // 4 segundos antes de ocultar los controles
        this.heroSlideInterval = null;
        this.currentHeroSlide = 0;
        
        this.stallCount = 0;
        this.stableMode = false;
        this.bufferInterval = null;

        this.initializeElements();
        this.setupEventListeners();
        this.loadMovies();
    }

    initializeElements() {
        // Contenedores principales
        this.moviesContainer = document.getElementById('moviesContainer');
        this.playerModal = document.getElementById('playerModal');

        // Inputs y Botones
        this.searchInput = document.getElementById('searchInput');
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
        this.progressBar = document.getElementById('progressBar');
        this.progressFilled = document.getElementById('progressFilled');

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

        // Lista de películas relacionadas
        this.relatedList = document.getElementById('relatedList');

        // Hero Slideshow
        this.heroSlidesContainer = document.getElementById('heroSlides');

        // Footer & Términos
        this.termsBtn = document.getElementById('termsBtn');
        this.termsModal = document.getElementById('termsModal');
        this.closeTermsBtn = document.getElementById('closeTermsBtn');
    }

    setupEventListeners() {
        // Búsqueda
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.handleSearch(e));
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
            this.videoPlayer.addEventListener('click', () => this.togglePlayPause());
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
            this.progressBar.addEventListener('click', (e) => this.seekVideo(e));
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

            // Manejo de errores
            this.videoPlayer.addEventListener('error', (e) => this.handleVideoError(e));
        }

        // Mostrar/ocultar controles en hover
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

            // Event listeners para movimiento del ratón
            videoContainer.addEventListener('mousemove', showControls);
            videoContainer.addEventListener('mouseenter', showControls);

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

        this.renderContinueWatching();
        this.render();
    }

    handleSearch() { this.filterMovies(); }

    handleCategoryChange(e) {
        this.categoryBtns.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        this.currentCategory = e.target.dataset.category;
        this.filterMovies();
    }

    updateTime() {
        if (this.currentTimeEl && this.videoPlayer) {
            this.currentTimeEl.textContent = this.formatTime(this.videoPlayer.currentTime);

            // Guardar progreso cada segundo (evita guardar en cada milisegundo)
            if (Math.floor(this.videoPlayer.currentTime) !== this.lastSavedSecond) {
                this.saveProgress();
                this.lastSavedSecond = Math.floor(this.videoPlayer.currentTime);
            }
        }
    }

    updateDuration() {
        if (this.durationEl && this.videoPlayer) {
            const duration = this.videoPlayer.duration;
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
        if (!this.videoPlayer) return;

        this.videoPlayer.muted = !this.videoPlayer.muted;
        this.updateMuteButton();
    }

    updateMuteButton() {
        if (!this.muteBtn || !this.videoPlayer) return;

        const img = this.muteBtn.querySelector('img');
        if (this.videoPlayer.muted || this.videoPlayer.volume === 0) {
            if (img) img.src = 'Assets/volumeOff.png';
        } else {
            if (img) img.src = 'Assets/volumeOn.png';
        }
    }

    changeVolume(value) {
        if (!this.videoPlayer) return;

        this.videoPlayer.volume = value / 100;
        this.videoPlayer.muted = false;
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

            // Si la API falla, usar fallback con clase CSS
            if (fsPromise && fsPromise.catch) {
                fsPromise.catch(() => {
                    videoWrapper.classList.add('is-fullscreen');
                    document.body.style.overflow = 'hidden';
                });
            } else if (!fsPromise) {
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

            // Siempre quitar la clase de fallback
            videoWrapper.classList.remove('is-fullscreen');

            if (this.fullscreenBtn) this.fullscreenBtn.querySelector('img').src = 'Assets/fullscreen.png';
        }
    }

    updateProgressBar() {
        if (!this.progressFilled || !this.videoPlayer) return;

        const percent = (this.videoPlayer.currentTime / this.videoPlayer.duration) * 100;
        this.progressFilled.style.width = `${percent}%`;
    }

    seekVideo(e) {
        if (!this.progressBar || !this.videoPlayer) return;

        const rect = this.progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        this.videoPlayer.currentTime = percent * this.videoPlayer.duration;
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
        this.showLoading();
    }

    handleBuffering() {
        this.showLoading();
        this.stallCount++;
        
        // Si se atasca más de 2 veces, activar modo estable automáticamente
        if (this.stallCount > 2 && !this.stableMode) {
            this.activateStableMode();
        }

        if (this.stableMode) {
            // En modo estable, pausamos y esperamos a tener más buffer para evitar cortes
            if (!this.videoPlayer.paused) this.videoPlayer.pause();
            
            if (this.bufferInterval) clearInterval(this.bufferInterval);
            
            this.bufferInterval = setInterval(() => {
                if (!this.videoPlayer) return;
                
                const buffered = this.videoPlayer.buffered;
                const current = this.videoPlayer.currentTime;
                let loadedEnd = 0;

                // Encontrar hasta dónde ha cargado el navegador
                for (let i = 0; i < buffered.length; i++) {
                    if (buffered.start(i) <= current && buffered.end(i) >= current) {
                        loadedEnd = buffered.end(i);
                        break;
                    }
                }

                // Objetivo: Cargar 8 segundos por delante o llegar al final
                const targetBuffer = 8; 
                const remaining = this.videoPlayer.duration - current;
                const needed = Math.min(targetBuffer, remaining);

                if ((loadedEnd - current) >= needed || loadedEnd >= this.videoPlayer.duration - 0.5) {
                    clearInterval(this.bufferInterval);
                    this.videoPlayer.play().catch(e => console.error('Reanudando...', e));
                }
            }, 1000);
        }
    }

    showLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.add('active');
            // Asegurar que el mensaje sea "CARGANDO..."
            const span = this.loadingOverlay.querySelector('span');
            if (span) {
                span.textContent = this.stableMode ? 'OPTIMIZANDO BÚFER...' : 'CARGANDO...';
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

    // Gestión de Progreso
    saveProgress() {
        if (!this.currentMovie || !this.videoPlayer) return;
        const data = JSON.parse(localStorage.getItem(this.progressKey)) || {};
        data[this.currentMovie.id] = this.videoPlayer.currentTime;
        localStorage.setItem(this.progressKey, JSON.stringify(data));
    }

    getSavedProgress(id) {
        const data = JSON.parse(localStorage.getItem(this.progressKey)) || {};
        return data[id] || 0;
    }

    renderContinueWatching() {
        if (!this.continueWatchingContainer || !this.continueWatchingSection) return;

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
            tempVideo.src = movie.videoUrl;
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
    playMovie(movie) {
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
            this.videoPlayer.src = movie.videoUrl;

            // C) Cargar
            this.videoPlayer.load();

            // D) Restaurar progreso si existe
            const savedTime = this.getSavedProgress(movie.id);
            if (savedTime > 0) {
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
    }

    closePlayer() {
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
    }

    // ==========================================
    //  GESTIÓN DE FAVORITOS
    // ==========================================
    toggleFavorite() {
        if (!this.currentMovie) return;

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
}

document.addEventListener('DOMContentLoaded', () => {
    new NexoTVStreaming();
});

// Function to detect mobile devices
function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Function to show mobile restriction alert
function showMobileRestrictionAlert() {
    if (isMobileDevice()) {
        alert("NEXO.TV no está disponible en dispositivos móviles. Por favor, accede desde un ordenador o un dispositivo compatible.");
        document.body.innerHTML = "<h1 style='color: white; text-align: center; margin-top: 20%;'>NEXO.TV no está disponible en dispositivos móviles. Por favor, accede desde un ordenador o un dispositivo compatible.</h1>";
    }
}

// Function to detect Amazon Fire Stick
function isAmazonFireStick() {
    return /AFT|Fire_TV/i.test(navigator.userAgent);
}

// Function to adjust controls for Amazon Fire Stick
function adjustControlsForFireStick() {
    if (isAmazonFireStick()) {
        const videoPlayer = document.getElementById('videoPlayer');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const muteBtn = document.getElementById('muteBtn');
        const fullscreenBtn = document.getElementById('fullscreenBtn');

        // Add keydown event listener for Fire Stick remote
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Enter': // Play/Pause
                    if (videoPlayer.paused) {
                        videoPlayer.play();
                    } else {
                        videoPlayer.pause();
                    }
                    break;
                case 'ArrowUp': // Volume Up
                    videoPlayer.volume = Math.min(videoPlayer.volume + 0.1, 1);
                    break;
                case 'ArrowDown': // Volume Down
                    videoPlayer.volume = Math.max(videoPlayer.volume - 0.1, 0);
                    break;
                case 'ArrowRight': // Seek Forward
                    videoPlayer.currentTime = Math.min(videoPlayer.currentTime + 10, videoPlayer.duration);
                    break;
                case 'ArrowLeft': // Seek Backward
                    videoPlayer.currentTime = Math.max(videoPlayer.currentTime - 10, 0);
                    break;
                case 'F': // Fullscreen
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    } else {
                        videoPlayer.requestFullscreen();
                    }
                    break;
                default:
                    break;
            }
        });

        console.log('Controles ajustados para Amazon Fire Stick.');
    }
}

// Call the function on page load
window.onload = function() {
    showMobileRestrictionAlert();
    adjustControlsForFireStick();
};