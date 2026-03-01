const { twitterApi, formatDate } = require('./twitter-helper');

async function main() {
  const query = process.argv[2];
  const count = Math.min(Number.parseInt(process.argv[3]) || 10, 100);

  if (!query) {
    console.log('Usage: node search_tweets.js "<query>" [count]');
    console.log('Examples: "AI agents", "#OpenAI", "from:elonmusk"');
    process.exit(1);
  }

  const params = new URLSearchParams({
    query,
    max_results: String(Math.max(count, 10)),
    'tweet.fields': 'created_at,public_metrics,author_id',
    expansions: 'author_id',
    'user.fields': 'name,username',
  });

  const data = await twitterApi(`/2/tweets/search/recent?${params}`);

  if (!data.data || data.data.length === 0) {
    console.log(`No tweets found for "${query}".`);
    if (data.errors) {
      console.log('API Error:', data.errors[0]?.message || JSON.stringify(data.errors));
    }
    return;
  }

  const users = new Map();
  if (data.includes?.users) {
    for (const u of data.includes.users) {
      users.set(u.id, u);
    }
  }

  console.log(`\n🐦 Search results for "${query}" (${data.data.length} tweets):\n`);

  for (const tweet of data.data.slice(0, count)) {
    const author = users.get(tweet.author_id);
    const metrics = tweet.public_metrics || {};
    const name = author ? `${author.name} (@${author.username})` : 'Unknown';

    console.log(`  ${name}`);
    console.log(`  ${tweet.text}`);
    console.log(`  ❤️ ${metrics.like_count || 0}  🔁 ${metrics.retweet_count || 0}  💬 ${metrics.reply_count || 0}  ${formatDate(tweet.created_at)}`);
    if (author) {
      console.log(`  Link: https://x.com/${author.username}/status/${tweet.id}`);
    }
    console.log();
  }

  if (data.meta?.result_count) {
    console.log(`Results returned: ${data.meta.result_count}`);
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
