import { mkdir, readFile, writeFile } from 'node:fs/promises';

const user = 'KaranVish20';
const out = new URL('../assets/cards/', import.meta.url);
const font = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
const api = async path => {
  const response = await fetch(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json', ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}) } });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
};
const card = (title, body, height, note = 'AUTO-REFRESH: EVERY 2 HOURS') => `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="${height}" viewBox="0 0 920 ${height}" role="img"><defs><linearGradient id="background" x2="1" y2="1"><stop stop-color="#0b0f17"/><stop offset="1" stop-color="#15102a"/></linearGradient><linearGradient id="line" x2="1"><stop stop-color="#8b5cf6" stop-opacity=".12"/><stop offset=".5" stop-color="#c084fc"/><stop offset="1" stop-color="#8b5cf6" stop-opacity=".12"/></linearGradient></defs><rect x="1" y="1" width="918" height="${height - 2}" rx="20" fill="url(#background)" stroke="#8b5cf6" stroke-opacity=".72" stroke-width="2"/><rect x="18" y="18" width="884" height="${height - 36}" rx="13" fill="none" stroke="#fff" stroke-opacity=".055"/><circle cx="48" cy="48" r="6" fill="#ff5f57"/><circle cx="70" cy="48" r="6" fill="#febc2e"/><circle cx="92" cy="48" r="6" fill="#28c840"/><text x="124" y="57" fill="#c4b5fd" font-family="${font}" font-size="23" font-weight="700">&gt; ${escape(title)}</text><rect x="42" y="88" width="836" height="1" fill="url(#line)"/>${body}<rect x="42" y="${height - 54}" width="836" height="1" fill="url(#line)"/><text x="42" y="${height - 27}" fill="#64748b" font-family="${font}" font-size="14">${escape(note)}</text></svg>`;
const metric = (x, name, value) => `<text x="${x}" y="135" fill="#94a3b8" font-family="${font}" font-size="16">${escape(name).toUpperCase()}</text><text x="${x}" y="172" fill="#f5f3ff" font-family="${font}" font-size="31" font-weight="700">${escape(value)}</text>`;
const eventText = event => ({ PushEvent: `Pushed commits to ${event.repo?.name || 'a repository'}`, PullRequestEvent: `Updated a pull request in ${event.repo?.name || 'a repository'}`, CreateEvent: `Created ${event.payload?.ref_type || 'repository'} in ${event.repo?.name || user}`, IssuesEvent: `Updated an issue in ${event.repo?.name || 'a repository'}` }[event.type] || `Activity in ${event.repo?.name || 'GitHub'}`);

async function liveData() {
  const fallback = { profile: { public_repos: 0, followers: 0 }, repos: [], events: [], languages: [['TypeScript', 46], ['JavaScript', 28], ['CSS', 14], ['HTML', 12]], contributions: 'N/A', weeks: Array.from({ length: 24 }, () => Array(7).fill(0)), recent24h: 0 };
  try {
    const [profile, repos, events] = await Promise.all([api(`/users/${user}`), api(`/users/${user}/repos?per_page=100&sort=updated`), api(`/users/${user}/events/public?per_page=5`)]);
    const recent24h = (await api(`/users/${user}/events?per_page=100`)).filter(event => Date.now() - new Date(event.created_at).getTime() < 24 * 60 * 60 * 1000).length;
    const totals = {};
    await Promise.all(repos.slice(0, 30).map(async repo => { try { for (const [name, bytes] of Object.entries(await api(`/repos/${user}/${repo.name}/languages`))) totals[name] = (totals[name] || 0) + bytes; } catch {} }));
    const total = Object.values(totals).reduce((sum, value) => sum + value, 0) || 1;
    const languages = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, bytes]) => [name, Math.round(bytes * 100 / total)]);
    let contributions = 'N/A', weeks = fallback.weeks;
    if (process.env.GH_TOKEN) {
      const query = `query { user(login: "${user}") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { contributionCount } } } } } }`;
      const response = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
      const calendar = response.ok ? (await response.json()).data?.user?.contributionsCollection?.contributionCalendar : null;
      if (calendar) { contributions = calendar.totalContributions; weeks = calendar.weeks.slice(-24).map(week => week.contributionDays.map(day => day.contributionCount)); }
    }
    return { profile, repos, events, languages: languages.length ? languages : fallback.languages, contributions, weeks, recent24h };
  } catch (error) { console.warn(`GitHub data unavailable; wrote fallback cards. ${error.message}`); return fallback; }
}

async function generate() {
  await mkdir(out, { recursive: true });
  const projects = JSON.parse(await readFile(new URL('../config/projects.json', import.meta.url), 'utf8'));
  const live = await liveData();
  const stars = live.repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
  const featuredRows = projects.completed.map((project, i) => `<g transform="translate(42 ${145 + i * 118})"><rect width="836" height="101" rx="12" fill="#171427" stroke="#8b5cf6" stroke-opacity=".35"/><rect width="5" height="101" rx="3" fill="#a78bfa"/><text x="28" y="37" fill="#e9d5ff" font-family="${font}" font-size="20" font-weight="700">0${i + 1} / ${escape(project.title)}</text><text x="28" y="63" fill="#cbd5e1" font-family="${font}" font-size="14">${escape(project.description)}</text><text x="28" y="87" fill="#a78bfa" font-family="${font}" font-size="12">${escape(project.stack.join('  /  ').toUpperCase())}</text><text x="731" y="49" fill="#7ee787" font-family="${font}" font-size="13" font-weight="700">OK SHIPPED</text></g>`).join('');
  const featured = card('featured-projects', `<text x="42" y="122" fill="#7ee787" font-family="${font}" font-size="14" font-weight="700">COMPLETED / SELECTED WORK</text>${featuredRows}`, 530, 'STATUS: CURATED MANUALLY');
  const level = count => count ? (count > 10 ? '#c084fc' : count > 5 ? '#8b5cf6' : count > 2 ? '#5b3c91' : '#2a1e45') : '#251d3c';
  const squares = live.weeks.flatMap((week, x) => week.map((count, y) => `<rect x="${42 + x * 31}" y="${218 + y * 25}" width="18" height="18" rx="3" fill="${level(count)}" stroke="#5b3c91" stroke-opacity=".55"/>`)).join('');
  const stats = card('github-status', `${metric(42, 'Public repos', live.profile.public_repos)}${metric(254, 'Stars', stars)}${metric(466, 'Followers', live.profile.followers)}${metric(678, 'Contributions', live.contributions)}<text x="42" y="207" fill="#94a3b8" font-family="${font}" font-size="16">CONTRIBUTION ACTIVITY / LAST 24 WEEKS</text><text x="878" y="207" text-anchor="end" fill="#7ee787" font-family="${font}" font-size="16" font-weight="700">LAST 24 HRS: ${escape(live.recent24h)} EVENTS</text>${squares}<text x="42" y="424" fill="#64748b" font-family="${font}" font-size="14">LESS</text><rect x="91" y="410" width="16" height="16" rx="3" fill="#251d3c" stroke="#5b3c91"/><rect x="115" y="410" width="16" height="16" rx="3" fill="#2a1e45"/><rect x="139" y="410" width="16" height="16" rx="3" fill="#5b3c91"/><rect x="163" y="410" width="16" height="16" rx="3" fill="#8b5cf6"/><rect x="187" y="410" width="16" height="16" rx="3" fill="#c084fc"/><text x="215" y="424" fill="#64748b" font-family="${font}" font-size="14">MORE</text>`, 490);
  const colors = ['#60a5fa', '#facc15', '#a78bfa', '#fb923c', '#34d399'];
  const languages = card('top-languages', live.languages.map(([name, percent], i) => `<circle cx="58" cy="${140 + i * 57}" r="9" fill="${colors[i]}"/><text x="84" y="${147 + i * 57}" fill="#e9d5ff" font-family="${font}" font-size="21">${escape(name)}</text><text x="850" y="${147 + i * 57}" text-anchor="end" fill="#c4b5fd" font-family="${font}" font-size="21" font-weight="700">${percent}%</text><rect x="84" y="${159 + i * 57}" width="766" height="7" rx="3.5" fill="#251d3c"/><rect x="84" y="${159 + i * 57}" width="${Math.max(10, Math.round(766 * percent / 100))}" height="7" rx="3.5" fill="${colors[i]}"/>`).join(''), 460);
  const activityRows = (live.events.length ? live.events : [{ type: 'PushEvent', repo: { name: user } }]).slice(0, 5).map((event, i) => `<circle cx="55" cy="${140 + i * 55}" r="6" fill="#7ee787"><animate attributeName="r" values="5;8;5" dur="2.2s" begin="${i * .18}s" repeatCount="indefinite"/></circle><text x="79" y="${147 + i * 55}" fill="#e9d5ff" font-family="${font}" font-size="18">${escape(eventText(event))}</text>`).join('');
  const activity = card('recent-activity', activityRows, 470);
  await Promise.all([['featured-projects.svg', featured], ['github-stats.svg', stats], ['top-languages.svg', languages], ['recent-activity.svg', activity]].map(([file, svg]) => writeFile(new URL(file, out), svg)));
}
generate();
