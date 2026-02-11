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

        // Lista de relacionados
        this.relatedList = document.getElementById('relatedList');
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
            this.videoPlayer.addEventListener('loadstart', () => this.showLoading());
            this.videoPlayer.addEventListener('waiting', () => this.showLoading());
            this.videoPlayer.addEventListener('canplay', () => this.hideLoading());
            this.videoPlayer.addEventListener('playing', () => this.hideLoading());

            // Manejo de errores
            this.videoPlayer.addEventListener('error', (e) => this.handleVideoError(e));
        }

        // Mostrar/ocultar controles en hover
        if (this.videoOverlay) {
            let hideTimeout;
            const showControls = () => {
                this.videoOverlay.classList.add('show');
                clearTimeout(hideTimeout);
                hideTimeout = setTimeout(() => {
                    if (!this.videoPlayer.paused) {
                        this.videoOverlay.classList.remove('show');
                    }
                }, 3000);
            };

            this.videoOverlay.parentElement.addEventListener('mousemove', showControls);
            this.videoOverlay.parentElement.addEventListener('mouseleave', () => {
                clearTimeout(hideTimeout);
                if (!this.videoPlayer.paused) {
                    this.videoOverlay.classList.remove('show');
                }
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
                    if (this.fullscreenBtn) this.fullscreenBtn.textContent = '⛶';
                } else if (!document.fullscreenElement) {
                    this.closePlayer();
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
        }
    }

    filterMovies() {
        const term = this.searchInput ? this.searchInput.value.toLowerCase() : '';

        this.filteredMovies = this.movies.filter(movie => {
            // Filtro Categoría
            let matchCat = (this.currentCategory === 'all') ||
                (this.currentCategory === 'essential' && movie.isEssential) ||
                (this.currentCategory === 'original' && movie.isOriginal);

            // Filtro Búsqueda
            let matchSearch = !term ||
                movie.titulo.toLowerCase().includes(term) ||
                (movie.sinopsis && movie.sinopsis.toLowerCase().includes(term));

            return matchCat && matchSearch;
        });

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
        if (this.playPauseBtn) this.playPauseBtn.textContent = '⏸';
        if (this.centerPlayBtn) this.centerPlayBtn.classList.add('playing');
        if (this.videoOverlay) this.videoOverlay.classList.add('show');
    }

    onVideoPause() {
        if (this.playPauseBtn) this.playPauseBtn.textContent = '▶';
        if (this.centerPlayBtn) this.centerPlayBtn.classList.remove('playing');
        if (this.videoOverlay) this.videoOverlay.classList.add('show');
    }

    onVideoEnded() {
        if (this.playPauseBtn) this.playPauseBtn.textContent = '▶';
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

        if (this.videoPlayer.muted || this.videoPlayer.volume === 0) {
            this.muteBtn.textContent = '🔇';
        } else {
            this.muteBtn.textContent = '🔊';
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

            if (this.fullscreenBtn) this.fullscreenBtn.textContent = '⮌';
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

            if (this.fullscreenBtn) this.fullscreenBtn.textContent = '⛶';
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

    showLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.add('active');
            // Asegurar que el mensaje sea "CARGANDO..."
            const span = this.loadingOverlay.querySelector('span');
            if (span) span.textContent = 'CARGANDO...';
        }
    }

    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.remove('active');
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
                    <button class="play-button">▶</button>
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
            if (this.playPauseBtn) this.playPauseBtn.textContent = '▶';
            if (this.centerPlayBtn) this.centerPlayBtn.classList.remove('playing');
            if (this.progressFilled) this.progressFilled.style.width = '0%';
            if (this.videoOverlay) this.videoOverlay.classList.add('show');

            // F) Intentar reproducir suavemente
            const playPromise = this.videoPlayer.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    console.log('Autoplay bloqueado por el navegador. El usuario debe pulsar play.');
                    // No pasa nada, los controles nativos mostrarán el botón de play gigante.
                });
            }
        }

        // 3. Cargar relacionados y mostrar modal
        this.loadRelatedMovies(movie);
        if (this.playerModal) this.playerModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closePlayer() {
        if (this.playerModal) this.playerModal.classList.remove('active');
        document.body.style.overflow = 'auto';

        // Limpiar el reproductor para que deje de descargar datos
        if (this.videoPlayer) {
            this.videoPlayer.pause();
            this.videoPlayer.currentTime = 0;
            this.videoPlayer.removeAttribute('src'); // Elimina la fuente completamente
            this.videoPlayer.load();
        }
        this.currentMovie = null;
    }

    loadRelatedMovies(current) {
        if (!this.relatedList) return;
        this.relatedList.innerHTML = '';

        const related = this.movies
            .filter(m => m.id !== current.id)
            .slice(0, 4);

        related.forEach(m => {
            const el = document.createElement('div');
            el.className = 'related-item';
            el.innerHTML = `<img src="${m.poster}" alt="${m.titulo}"><span>${m.titulo}</span>`;
            el.addEventListener('click', () => this.playMovie(m));
            this.relatedList.appendChild(el);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new NexoTVStreaming();
});