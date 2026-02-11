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
        // NOTA: Ya no necesitamos videoSource porque usaremos src directo
        
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
        if(this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.handleSearch(e));
        }

        // Categorías
        this.categoryBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleCategoryChange(e));
        });

        // Cerrar Modal (Botón X)
        if(this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closePlayer());
        }

        // Cerrar Modal (Clic fuera)
        if(this.playerModal) {
            this.playerModal.addEventListener('click', (e) => {
                if (e.target === this.playerModal) {
                    this.closePlayer();
                }
            });
        }

        // Teclado (Escape para cerrar)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.playerModal.classList.contains('active')) {
                this.closePlayer();
            }
        });

        // Listeners de Video para tiempo
        if (this.videoPlayer) {
            this.videoPlayer.addEventListener('timeupdate', () => this.updateTime());
            this.videoPlayer.addEventListener('loadedmetadata', () => this.updateDuration());
        }
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
        if(this.playerTitle) this.playerTitle.textContent = movie.titulo;
        if(this.playerSynopsis) this.playerSynopsis.textContent = movie.sinopsis;
        if(this.detailYear) this.detailYear.textContent = movie.año;
        if(this.detailCategory) this.detailCategory.textContent = movie.categoria || 'General';
        
        let type = 'Estándar';
        if(movie.isEssential) type = 'Essential Masterpiece';
        if(movie.isOriginal) type = 'NEXO Original';
        if(this.detailType) this.detailType.textContent = type;

        // 2. Configurar el Video (LA PARTE CLAVE)
        if (this.videoPlayer) {
            // Reseteamos el reproductor
            this.videoPlayer.pause();
            if(this.currentTimeEl) this.currentTimeEl.textContent = "0:00";
            if(this.durationEl) this.durationEl.textContent = "0:00";

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

            // D) Intentar reproducir suavemente
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