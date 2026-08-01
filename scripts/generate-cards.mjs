import { mkdir, readFile, writeFile } from 'node:fs/promises';

const user = 'KaranVish20';
const root = new URL('../', import.meta.url);
const out = new URL('../assets/cards/', import.meta.url);
const font = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
const request = async path => {
  const response = await fetch(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json', ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}) } });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
};
const wrap = (title, body, h = 390, note = 'AUTO-REFRESH: EVERY 6 HOURS') => `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="${h}" viewBox="0 0 920 ${h}" role="img"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#0b0f17"/><stop offset="1" stop-color="#15102a"/></linearGradient><linearGradient id="l" x2="1"><stop stop-color="#8b5cf6" stop-opacity=".12"/><stop offset=".5" stop-color="#c084fc"/><stop offset="1" stop-color="#8b5cf6" stop-opacity=".12"/></linearGradient></defs><rect x="1" y="1" width="918" height="${h - 2}" rx="20" fill="url(#g)" stroke="#8b5cf6" stroke-opacity=".72" stroke-width="2"/><rect x="18" y="18" width="884" height="${h - 36}" rx="13" fill="none" stroke="#fff" stroke-opacity=".055"/><circle cx="48" cy="48" r="6" fill="#ff5f57"/><circle cx="70" cy="48" r="6" fill="#febc2e"/><circle cx="92" cy="48" r="6" fill="#28c840"/><text x="124" y="55" fill="#c4b5fd" font-family="${font}" font-size="20" font-weight="700">&gt; ${esc(title)}</text><rect x="42" y="82" width="836" height="1" fill="url(#l)"/>${body}<rect x="42" y="${h - 54}" width="836" height="1" fill="url(#l)"/><text x="42" y="${h - 29}" fill="#64748b" font-family="${font}" font-size="12">${esc(note)}</text></svg>`;
const label = (x, y, name, value) => `<text x="${x}" y="${y}" fill="#94a3b8" font-family="${font}" font-size="13">${esc(name).toUpperCase()}</text><text x="${x}" y="${y + 31}" fill="#f5f3ff" font-family="${font}" font-size="25" font-weight="700">${esc(value)}</text>`;
const bar = (y, name, percent) => `<text x="42" y="${y}" fill="#e9d5ff" font-family="${font}" font-size="15" font-weight="700">${esc(name)}</text><text x="852" y="${y}" text-anchor="end" fill="#c4b5fd" font-family="${font}" font-size="14">${percent}%</text><rect x="42" y="${y + 13}" width="810" height="10" rx="5" fill="#251d3c"/><rect x="42" y="${y + 13}" width="${Math.max(8, Math.round(810 * percent / 100))}" height="10" rx="5" fill="#a78bfa"/>`;
const pill = (x, y, text) => `<rect x="${x}" y="${y}" width="${text.length * 9 + 32}" height="32" rx="16" fill="#21183a" stroke="#8b5cf6" stroke-opacity=".5"/><text x="${x + 16}" y="${y + 21}" fill="#ddd6fe" font-family="${font}" font-size="13" font-weight="700">${esc(text)}</text>`;

async function data() {
  const fallback = { profile: { public_repos: 0, followers: 0 }, repos: [], events: [], languages: [['TypeScript', 46], ['JavaScript', 28], ['CSS', 14], ['HTML', 12]], contributions: 'N/A' };
  try {
    const [profile, repos, events] = await Promise.all([request(`/users/${user}`), request(`/users/${user}/repos?per_page=100&sort=updated`), request(`/users/${user}/events/public?per_page=5`)]);
    const totals = {};
    await Promise.all(repos.slice(0, 30).map(async repo => { try { for (const [name, bytes] of Object.entries(await request(`/repos/${user}/${repo.name}/languages`))) totals[name] = (totals[name] || 0) + bytes; } catch {} }));
    const total = Object.values(totals).reduce((sum, value) => sum + value, 0) || 1;
    const languages = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, bytes]) => [name, Math.round(bytes * 100 / total)]);
    let contributions = 'N/A';
    if (process.env.GH_TOKEN) {
      const query = `query { user(login: "${user}") { contributionsCollection { contributionCalendar { totalContributions } } } }`;
      const response = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
      if (response.ok) contributions = (await response.json()).data?.user?.contributionsCollection?.contributionCalendar?.totalContributions ?? contributions;
    }
    return { profile, repos, events, languages: languages.length ? languages : fallback.languages, contributions };
  } catch (error) { console.warn(`GitHub data unavailable; wrote fallback cards. ${error.message}`); return fallback; }
}

const eventText = event => ({ PushEvent: `Pushed commits to ${event.repo?.name || 'a repository'}`, PullRequestEvent: `Updated a pull request in ${event.repo?.name || 'a repository'}`, CreateEvent: `Created ${event.payload?.ref_type || 'repository'} in ${event.repo?.name || user}`, IssuesEvent: `Updated an issue in ${event.repo?.name || 'a repository'}` }[event.type] || `Activity in ${event.repo?.name || 'GitHub'}`);
async function generate() {
  await mkdir(out, { recursive: true });
  const projects = JSON.parse(await readFile(new URL('../config/projects.json', import.meta.url), 'utf8'));
  const live = await data();
  const stars = live.repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
  const featuredRows = projects.completed.map((project, i) => `<g transform="translate(42 ${145 + i * 118})"><rect width="836" height="101" rx="12" fill="#171427" stroke="#8b5cf6" stroke-opacity=".35"/><rect width="5" height="101" rx="3" fill="#a78bfa"/><text x="28" y="37" fill="#e9d5ff" font-family="${font}" font-size="20" font-weight="700">0${i + 1} / ${esc(project.title)}</text><text x="28" y="63" fill="#cbd5e1" font-family="${font}" font-size="14">${esc(project.description)}</text><text x="28" y="87" fill="#a78bfa" font-family="${font}" font-size="12">${esc(project.stack.join('  /  ').toUpperCase())}</text><text x="731" y="49" fill="#7ee787" font-family="${font}" font-size="13" font-weight="700">OK SHIPPED</text></g>`).join('');
  const featured = wrap('featured-projects', `<text x="42" y="122" fill="#7ee787" font-family="${font}" font-size="14" font-weight="700">COMPLETED / SELECTED WORK</text>${featuredRows}`, 530, 'STATUS: CURATED MANUALLY');
  const stats = wrap('github-stats', `${label(42, 127, 'Public repos', live.profile.public_repos)}${label(264, 127, 'Stars', stars)}${label(486, 127, 'Followers', live.profile.followers)}${label(708, 127, 'Contributions', live.contributions)}<text x="42" y="257" fill="#94a3b8" font-family="${font}" font-size="13">LIVE DATA FROM GITHUB</text><text x="42" y="291" fill="#ddd6fe" font-family="${font}" font-size="15">Repositories, stars and followers are refreshed automatically.</text>`, 350);
  const languages = wrap('top-languages', live.languages.map(([name, value], i) => bar(125 + i * 55, name, value)).join(''), 410);
  const stack = ['TypeScript', 'JavaScript', 'React', 'Next.js', 'Tailwind CSS', 'Figma', 'Rust', 'Python'];
  const tech = wrap('tech-stack', `<text x="42" y="127" fill="#94a3b8" font-family="${font}" font-size="13">TOOLS I BUILD WITH</text>${stack.map((item, i) => pill(42 + (i % 4) * 207, 155 + Math.floor(i / 4) * 52, item)).join('')}<text x="42" y="304" fill="#cbd5e1" font-family="${font}" font-size="14">A practical stack for product, design and web development.</text>`, 360);
  const recent = (live.events.length ? live.events : [{ type: 'PushEvent', repo: { name: user } }]).slice(0, 5).map((event, i) => `<circle cx="53" cy="${126 + i * 42}" r="5" fill="#7ee787"/><text x="72" y="${131 + i * 42}" fill="#e9d5ff" font-family="${font}" font-size="14">${esc(eventText(event))}</text>`).join('');
  const activity = wrap('recent-activity', recent, 390);
  await Promise.all([['featured-projects.svg', featured], ['github-stats.svg', stats], ['top-languages.svg', languages], ['tech-stack.svg', tech], ['recent-activity.svg', activity]].map(([file, svg]) => writeFile(new URL(file, out), svg)));
}
generate();
