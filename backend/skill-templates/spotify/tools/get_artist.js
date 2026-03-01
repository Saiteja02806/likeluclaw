const { loadCredentials, spotifyApi } = require('./spotify-helper');

async function main() {
  const artistId = process.argv[2];

  if (!artistId) {
    console.log('Usage: node get_artist.js <artist_id>');
    console.log('Get the artist ID from search results.');
    process.exit(1);
  }

  const creds = loadCredentials();
  const artist = await spotifyApi(`/v1/artists/${artistId}`, creds);
  const topTracks = await spotifyApi(`/v1/artists/${artistId}/top-tracks?market=US`, creds);

  console.log(`\n🎤 ${artist.name}\n`);
  console.log(`  Genres: ${artist.genres.join(', ') || 'N/A'}`);
  console.log(`  Followers: ${artist.followers.total.toLocaleString()}`);
  console.log(`  Popularity: ${artist.popularity}/100`);
  console.log(`  Link: https://open.spotify.com/artist/${artist.id}`);

  if (topTracks.tracks && topTracks.tracks.length > 0) {
    console.log(`\n  🔥 Top Tracks:`);
    for (const t of topTracks.tracks.slice(0, 10)) {
      console.log(`    • ${t.name} — ${t.album.name} (Popularity: ${t.popularity})`);
    }
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
