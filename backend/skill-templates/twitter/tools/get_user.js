const { twitterApi, formatDate } = require('./twitter-helper');

async function main() {
  const username = process.argv[2];

  if (!username) {
    console.log('Usage: node get_user.js <username>');
    console.log('Example: node get_user.js openai');
    process.exit(1);
  }

  const clean = username.replace(/^@/, '');
  const params = new URLSearchParams({
    'user.fields': 'description,public_metrics,created_at,verified,profile_image_url',
  });

  const data = await twitterApi(`/2/users/by/username/${clean}?${params}`);

  if (!data.data) {
    console.log(`User @${clean} not found.`);
    if (data.errors) console.log('Error:', data.errors[0]?.detail || data.errors[0]?.message);
    return;
  }

  const u = data.data;
  const m = u.public_metrics || {};

  console.log(`\n👤 @${u.username} — ${u.name}\n`);
  console.log(`  Bio: ${u.description || 'No bio'}`);
  console.log(`  Followers: ${(m.followers_count || 0).toLocaleString()}`);
  console.log(`  Following: ${(m.following_count || 0).toLocaleString()}`);
  console.log(`  Tweets: ${(m.tweet_count || 0).toLocaleString()}`);
  console.log(`  Joined: ${formatDate(u.created_at)}`);
  console.log(`  Link: https://x.com/${u.username}`);

  // Fetch recent tweets
  const tweetParams = new URLSearchParams({
    max_results: '5',
    'tweet.fields': 'created_at,public_metrics',
  });
  const tweets = await twitterApi(`/2/users/${u.id}/tweets?${tweetParams}`);

  if (tweets.data && tweets.data.length > 0) {
    console.log(`\n  📝 Recent tweets:`);
    for (const t of tweets.data) {
      const tm = t.public_metrics || {};
      console.log(`    • ${t.text.slice(0, 120)}${t.text.length > 120 ? '...' : ''}`);
      console.log(`      ❤️ ${tm.like_count || 0}  🔁 ${tm.retweet_count || 0}  ${formatDate(t.created_at)}`);
    }
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
