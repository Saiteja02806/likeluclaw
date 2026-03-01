const { loadCredentials, spotifyApi, formatDuration } = require('./spotify-helper');

async function main() {
  const query = process.argv[2];
  const type = process.argv[3] || 'track';
  const limit = Math.min(parseInt(process.argv[4]) || 5, 20);

  if (!query) {
    console.log('Usage: node search.js "<query>" [track|artist|album|playlist] [limit]');
    process.exit(1);
  }

  const creds = loadCredentials();
  const params = new URLSearchParams({ q: query, type, limit: String(limit) });
  const data = await spotifyApi(`/v1/search?${params}`, creds);

  if (type === 'track' && data.tracks) {
    console.log(`\n🎵 Search results for "${query}" (tracks):\n`);
    for (const t of data.tracks.items) {
      const artists = t.artists.map(a => a.name).join(', ');
      console.log(`  ${t.name} — ${artists}`);
      console.log(`    Album: ${t.album.name} | Duration: ${formatDuration(t.duration_ms)} | Popularity: ${t.popularity}/100`);
      console.log(`    Link: https://open.spotify.com/track/${t.id}`);
      console.log();
    }
    console.log(`Total results: ${data.tracks.total}`);
  } else if (type === 'artist' && data.artists) {
    console.log(`\n🎤 Search results for "${query}" (artists):\n`);
    for (const a of data.artists.items) {
      console.log(`  ${a.name}`);
      console.log(`    Genres: ${a.genres.join(', ') || 'N/A'} | Followers: ${a.followers.total.toLocaleString()} | Popularity: ${a.popularity}/100`);
      console.log(`    Link: https://open.spotify.com/artist/${a.id}`);
      console.log();
    }
  } else if (type === 'album' && data.albums) {
    console.log(`\n💿 Search results for "${query}" (albums):\n`);
    for (const a of data.albums.items) {
      const artists = a.artists.map(ar => ar.name).join(', ');
      console.log(`  ${a.name} — ${artists}`);
      console.log(`    Released: ${a.release_date} | Tracks: ${a.total_tracks}`);
      console.log(`    Link: https://open.spotify.com/album/${a.id}`);
      console.log();
    }
  } else if (type === 'playlist' && data.playlists) {
    console.log(`\n📋 Search results for "${query}" (playlists):\n`);
    for (const p of data.playlists.items) {
      console.log(`  ${p.name} — by ${p.owner.display_name}`);
      console.log(`    Tracks: ${p.tracks.total} | ${p.description || 'No description'}`);
      console.log(`    Link: https://open.spotify.com/playlist/${p.id}`);
      console.log();
    }
  } else {
    console.log('No results found.');
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
