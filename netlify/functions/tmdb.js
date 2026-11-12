const TMDB_API_URL = 'https://api.themoviedb.org/3/movie';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';

const jsonResponse = (statusCode, body) => ({
    statusCode,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
});

exports.handler = async event => {
    if (event.httpMethod !== 'GET') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    const token = process.env.TMDB_READ_TOKEN;
    if (!token) {
        console.error('TMDB_READ_TOKEN is not configured');
        return jsonResponse(500, { error: 'TMDB integration is not configured' });
    }

    const ids = [...new Set((event.queryStringParameters?.ids || '')
        .split(',')
        .map(id => Number(id))
        .filter(id => Number.isInteger(id) && id > 0))];

    if (!ids.length || ids.length > 200) {
        return jsonResponse(400, { error: 'Provide between 1 and 200 TMDB movie IDs' });
    }

    const result = {};
    for (let start = 0; start < ids.length; start += 8) {
        const batch = await Promise.all(ids.slice(start, start + 8).map(async id => {
            const response = await fetch(`${TMDB_API_URL}/${id}?language=es-ES&append_to_response=credits`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.status === 404) return null;
            if (!response.ok) {
                console.error(`TMDB request failed for ${id}: ${response.status}`);
                throw new Error(`TMDB request failed for ${id}`);
            }

            const movie = await response.json();
            const directors = (movie.credits?.crew || [])
                .filter(person => person.job === 'Director')
                .map(person => person.name);
            const cast = (movie.credits?.cast || [])
                .slice(0, 5)
                .map(person => person.name);
            const companies = (movie.production_companies || []).map(company => company.name);
            const countries = (movie.production_countries || []).map(country => country.name);
            const genres = (movie.genres || []).map(genre => genre.name);

            return [id, {
                title: movie.title || movie.original_title || '',
                year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
                genres: genres.join(', '),
                poster: movie.poster_path ? `${IMAGE_BASE_URL}${movie.poster_path}` : '',
                landscape: movie.backdrop_path ? `${IMAGE_BASE_URL}${movie.backdrop_path}` : '',
                rating: typeof movie.vote_average === 'number' ? movie.vote_average : null,
                releaseDate: movie.release_date || '',
                duration: Number.isFinite(movie.runtime) ? movie.runtime : null,
                director: directors.join(', '),
                cast: cast.join(', '),
                producer: companies.join(', '),
                country: countries.join(', ')
            }];
        }));

        batch.filter(Boolean).forEach(([id, movie]) => {
            result[id] = movie;
        });
    }

    return jsonResponse(200, result);
};
