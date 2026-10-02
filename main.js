'use strict';

const $ = id => document.getElementById(id);
const pageName = document.documentElement.dataset.page;
const rootPath = document.documentElement.dataset.root || '.';
const make = (tag, className, value) => { const el = document.createElement(tag); if (className) el.className = className; if (value !== undefined) el.textContent = value; return el; };
const fromRoot = path => /^(?:https?:|mailto:|tel:|#)/i.test(path) ? path : `${rootPath}/${path}`.replace(/^\.\/\.\//, './');

function requireText(value, field) { if (typeof value !== 'string' || !value.trim()) throw new Error(`${field}: expected non-empty text.`); }
function requireArray(value, field) { if (!Array.isArray(value)) throw new Error(`${field}: expected a JSON array.`); }
function safeMaterialPath(value, field, extension) { requireText(value, field); const suffix = extension.replace('.', '\\.'); if (!new RegExp(`^materials\\/(?!.*\\.\\.)[\\w./% -]+${suffix}$`, 'i').test(value)) throw new Error(`${field}: use a ${extension} file under materials/ without "..".`); }
function requireRichText(value, field) { if (typeof value === 'string' && value.trim()) return; if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.markdown === 'string' && value.markdown.trim()) { safeMaterialPath(value.markdown, `${field}.markdown`, '.md'); return; } throw new Error(`${field}: expected text or { "markdown": "materials/.../file.md" }.`); }
function safeURL(value, field, allowContact = false) { requireText(value, field); const contact = allowContact && (/^mailto:/i.test(value) || /^tel:/i.test(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)); if (/^https?:\/\//i.test(value) || /^www\./i.test(value) || contact || /^materials\/(?!.*\.\.)[\w./% -]+$/.test(value)) return; throw new Error(`${field}: use a web address, email, telephone link, or a path under materials/.`); }
function normalizeLink(value) { if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`; if (/^www\./i.test(value)) return `https://${value}`; return value.startsWith('materials/') ? fromRoot(value) : value; }
function displayLink(value) { return value.replace(/^mailto:/i, '').replace(/^tel:/i, '').replace(/^https?:\/\//i, '').replace(/\/$/, ''); }
function initials(name) { return name.replace(/\([^)]*\)/g, '').split(/[\s,]+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase(); }

async function readJSON(path) { const url = fromRoot(path); let response; try { response = await fetch(url, { cache: 'no-store' }); } catch { throw new Error(`Cannot read ${path}. Open the repository through VS Code Live Server.`); } if (!response.ok) throw new Error(`Cannot load ${path} (HTTP ${response.status}).`); try { return await response.json(); } catch { throw new Error(`${path}: invalid JSON. Check commas, quotation marks, and brackets.`); } }
async function readText(path) { const url = fromRoot(path); let response; try { response = await fetch(url, { cache: 'no-store' }); } catch { throw new Error(`Cannot read ${path}. Open the repository through VS Code Live Server.`); } if (!response.ok) throw new Error(`Cannot load ${path} (HTTP ${response.status}).`); return response.text(); }

function sanitizeMarkdown(source) {
  if (!window.marked?.parse) throw new Error('The local Markdown renderer could not load.');
  const template = document.createElement('template'); template.innerHTML = window.marked.parse(source, { gfm: true });
  const allowed = new Set(['P','BR','STRONG','EM','A','UL','OL','LI','CODE','PRE','BLOCKQUOTE','H3','H4','H5','H6','HR']);
  for (const el of [...template.content.querySelectorAll('*')]) {
    const tag = el.tagName; if (['SCRIPT','STYLE','IFRAME','OBJECT','EMBED'].includes(tag)) { el.remove(); continue; } if (!allowed.has(tag)) { el.replaceWith(...el.childNodes); continue; }
    const href = tag === 'A' ? el.getAttribute('href') : null; for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
    if (tag === 'A' && href && (/^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^materials\/(?!.*\.\.)[\w./%#?&=+-]+$/i.test(href))) { el.href = href.startsWith('materials/') ? fromRoot(href) : href; if (/^https?:\/\//i.test(href)) { el.target = '_blank'; el.rel = 'noopener noreferrer'; } }
  }
  return template.content;
}

async function resolveRichText(value, field) { requireRichText(value, field); return typeof value === 'string' ? value : { fragment: sanitizeMarkdown(await readText(value.markdown)) }; }
function richText(value, className = '') { const el = make('div', `rich-text${className ? ` ${className}` : ''}`); if (typeof value === 'string') el.textContent = value; else el.append(value.fragment.cloneNode(true)); return el; }

function renderChrome(intro) {
  const pages = [['about','About',`${rootPath}/`],['experience','Experience',`${rootPath}/experience/`],['projects','Projects',`${rootPath}/projects/`],['resume','Résumé',`${rootPath}/resume/`],['contact','Contact',`${rootPath}/contact/`]];
  const nav = make('nav'); nav.setAttribute('aria-label', 'Main navigation');
  for (const [id, label, href] of pages) { const link = make('a', id === 'contact' ? 'contact-nav' : '', label); link.href = href; if (id === pageName) link.setAttribute('aria-current', 'page'); nav.append(link); }
  $('site-navigation').append(nav); $('site-footer').append(make('span', '', intro.name), make('span', '', `© ${new Date().getFullYear()}`));
  document.title = `${pages.find(item => item[0] === pageName)?.[1] || 'Portfolio'} · ${intro.name}`; document.querySelector('meta[name=description]').content = `${intro.name} — ${intro.title}`;
}

function enablePageNavigation() {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  for (const link of document.querySelectorAll('#site-navigation a')) {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reducedMotion.matches) return;
      const destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin || destination.href === location.href) return;
      event.preventDefault();
      document.documentElement.classList.add('page-leaving');
      window.setTimeout(() => { location.href = destination.href; }, 120);
    });
  }
}

function revealPage() {
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('content-ready')));
}

function validateIntro(intro) { for (const key of ['name','title']) requireText(intro[key], `materials/introduction.json → ${key}`); if (intro.photo && !intro.photo.startsWith('TODO:')) safeURL(intro.photo, 'materials/introduction.json → photo'); }
function validateLinks(links) { requireArray(links, 'materials/links.json'); links.forEach((link, i) => { const field = `materials/links.json → item ${i + 1}`; requireText(link.label, `${field}.label`); requireText(link.url, `${field}.url`); if (!link.url.startsWith('TODO:')) safeURL(link.url, `${field}.url`, true); }); }

async function renderAbout(intro) {
  const links = await readJSON('materials/links.json'); validateLinks(links); requireRichText(intro.bio, 'materials/introduction.json → bio'); intro.bio = await resolveRichText(intro.bio, 'materials/introduction.json → bio');
  $('profile-name').textContent = intro.name; $('profile-role').textContent = intro.title; $('profile-bio').replaceChildren(...richText(intro.bio).childNodes); $('profile-initials').textContent = initials(intro.name);
  if (intro.photo && !intro.photo.startsWith('TODO:')) { $('profile-photo').src = fromRoot(intro.photo); $('profile-photo').alt = `Portrait of ${intro.name}`; $('profile-photo').hidden = false; $('profile-initials').hidden = true; }
  const featured = new Set(['linkedin','github']); for (const item of links.filter(link => !link.url.startsWith('TODO:') && featured.has(link.label.toLowerCase()))) { const a = make('a', 'button dark-button', item.label); a.href = normalizeLink(item.url); a.target = '_blank'; a.rel = 'noopener noreferrer'; $('profile-actions').append(a); }
}

async function renderExperience() {
  const items = await readJSON('materials/experience.json'); requireArray(items, 'materials/experience.json');
  for (const [i, item] of items.entries()) { const field = `materials/experience.json → item ${i + 1}`; for (const key of ['role','company','period']) requireText(item[key], `${field}.${key}`); item.description = await resolveRichText(item.description, `${field}.description`); const card = make('article', 'experience-card'); card.append(make('h3', 'experience-company', item.company), make('p', 'experience-role', item.role), richText(item.description)); const meta = [item.location,item.period].filter(Boolean).join(' | '); if (meta) card.append(make('p','experience-meta',meta)); $('experience-list').append(card); }
}

async function readProjects() {
  const folders = await readJSON('materials/projects/index.json'); requireArray(folders, 'materials/projects/index.json');
  return Promise.all(folders.map(async (folder, i) => { requireText(folder, `materials/projects/index.json → item ${i + 1}`); if (!/^[a-z0-9][a-z0-9_-]*$/.test(folder)) throw new Error(`materials/projects/index.json → item ${i + 1}: invalid folder name.`); const source = `materials/projects/${folder}/info.json`; return { id:`project-${folder.replaceAll('_','-')}`, category:'Selected project', ...await readJSON(source), _source:source }; }));
}

function renderMedia(items, target) {
  for (const item of items) { const figure=make('figure','media'); const media=document.createElement(item.type==='image'?'img':item.type); if(item.type==='image'){media.src=fromRoot(item.src);media.alt=item.title;media.loading='lazy'} if(item.type==='video'){media.src=fromRoot(item.src);media.controls=true;media.playsInline=true;media.preload='metadata';if(item.poster)media.poster=fromRoot(item.poster);if(item.captions){const track=document.createElement('track');track.kind='captions';track.src=fromRoot(item.captions);track.srclang=item.language||'en';track.label=item.captionLabel||'Captions';media.append(track)}} if(item.type==='iframe'){media.dataset.src=fromRoot(item.src);media.title=item.title;media.loading='lazy'} figure.append(media);if(item.caption)figure.append(make('figcaption','',item.caption));target.append(figure); }
}

async function renderProjects() {
  const [overview, projects] = await Promise.all([readJSON('materials/projects/overview.json'), readProjects()]); requireText(overview.title,'materials/projects/overview.json → title'); overview.description=await resolveRichText(overview.description,'materials/projects/overview.json → description'); $('projects-title').textContent=overview.title; $('projects-description').replaceChildren(...richText(overview.description).childNodes);
  const ids=new Set();
  for (const project of projects) {
    for(const key of ['id','title','category'])requireText(project[key],`${project._source}.${key}`);for(const key of ['summary','challenge','contribution','result'])project[key]=await resolveRichText(project[key],`${project._source}.${key}`);if(ids.has(project.id))throw new Error(`${project._source}: duplicate project ID.`);ids.add(project.id);requireArray(project.tags,`${project._source}.tags`);requireArray(project.media,`${project._source}.media`);
    if(project.preview){requireText(project.preview.src,`${project._source}.preview.src`);requireText(project.preview.title,`${project._source}.preview.title`);if(!project.preview.src.startsWith('TODO:'))safeURL(project.preview.src,`${project._source}.preview.src`)}
    project.media.forEach((item,i)=>{const field=`${project._source}.media[${i}]`;if(!['image','video','iframe'].includes(item.type))throw new Error(`${field}.type: use image, video, or iframe.`);safeURL(item.src,`${field}.src`);requireText(item.title,`${field}.title`)});
    const card=make('article','project-card'),header=make('div','project-toggle'),preview=make('button','project-preview');preview.type='button';preview.setAttribute('aria-expanded','false');preview.setAttribute('aria-controls',`${project.id}-details`);preview.setAttribute('aria-label',`View details for ${project.title}`);
    if(project.preview&&!project.preview.src.startsWith('TODO:')){const image=document.createElement('img');image.src=fromRoot(project.preview.src);image.alt=project.preview.title;image.loading='lazy';preview.append(image)}else preview.append(make('span','project-monogram',initials(project.title)));
    const copy=make('div','project-copy');copy.append(make('p','project-category',project.category),make('h3','',project.title),richText(project.summary,'project-summary'));const tags=make('div','project-tags');project.tags.forEach(tag=>tags.append(make('span','project-tag',tag)));copy.append(tags);const open=make('button','project-open-button','View details');open.type='button';open.setAttribute('aria-expanded','false');open.setAttribute('aria-controls',`${project.id}-details`);copy.append(open);if(project.period)copy.append(make('p','project-period',project.period));header.append(preview,copy);
    const expanded=make('div','project-expanded');expanded.id=`${project.id}-details`;expanded.hidden=true;const details=make('div','project-details');for(const [heading,value]of[['Challenge',project.challenge],['My contribution',project.contribution],['Results',project.result]]){const section=document.createElement('section');section.append(make('h4','',heading),richText(value));details.append(section)}expanded.append(details);renderMedia(project.media,expanded);
    const toggle=()=>{const opening=expanded.hidden;expanded.hidden=!opening;preview.setAttribute('aria-expanded',String(opening));open.setAttribute('aria-expanded',String(opening));open.textContent=opening?'Hide details':'View details';if(opening)expanded.querySelectorAll('iframe').forEach(frame=>{if(!frame.hasAttribute('src'))frame.src=frame.dataset.src});else{expanded.querySelectorAll('video').forEach(video=>video.pause());expanded.querySelectorAll('iframe').forEach(frame=>frame.removeAttribute('src'))}};preview.addEventListener('click',toggle);open.addEventListener('click',toggle);card.append(header,expanded);$('project-list').append(card);
  }
}

async function renderResume(intro) { const resume=await readJSON('materials/resume.json');requireText(resume.file,'materials/resume.json → file');requireText(resume.downloadLabel,'materials/resume.json → downloadLabel');if(resume.file.startsWith('TODO:'))return;safeMaterialPath(resume.file,'materials/resume.json → file','.pdf');const path=fromRoot(resume.file),frame=document.createElement('iframe');frame.src=path;frame.title=`${intro.name} résumé`;frame.loading='lazy';$('resume-viewer').replaceChildren(frame);$('resume-download').href=path;$('resume-download').download='';$('resume-download').textContent=resume.downloadLabel;$('resume-download').hidden=false; }

async function renderContact() { const links=await readJSON('materials/links.json');validateLinks(links);for(const item of links.filter(link=>!link.url.startsWith('TODO:')&&!['résumé','resume'].includes(link.label.toLowerCase()))){const a=make('a','contact-item');a.href=normalizeLink(item.url);if(/^https?:/i.test(a.href)){a.target='_blank';a.rel='noopener noreferrer'}a.append(make('span','contact-label',item.label),make('span','contact-value',item.display||displayLink(item.url)));$('contact-list').append(a)} }

async function start() { const intro=await readJSON('materials/introduction.json');validateIntro(intro);renderChrome(intro);if(pageName==='about')await renderAbout(intro);else if(pageName==='experience')await renderExperience();else if(pageName==='projects')await renderProjects();else if(pageName==='resume')await renderResume(intro);else if(pageName==='contact')await renderContact();else throw new Error(`Unknown page: ${pageName}`);enablePageNavigation();revealPage(); }
start().catch(error=>{const loading=$('profile-name');if(loading)loading.textContent='Content needs attention';$('content-error').textContent=error.message;$('content-error').hidden=false;revealPage();console.error(error)});
