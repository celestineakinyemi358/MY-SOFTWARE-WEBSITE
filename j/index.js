/* ================= STATE ================= */
let currentUser = null;
let isVerifiedHuman = false;
let pendingMode = 'login';
let resetEmail = '';
let aiMessages = [];
let aiChatOpen = false;
let siteAuthenticated = false;

/* ================= PERSISTENT ACCOUNT STORAGE =================
   Accounts are saved with window.storage (this preview environment's
   built-in persistent store), so they survive a page reload. Passwords
   are hashed with SHA-256 before they're ever written to storage. */
async function hashPassword(password) {
  const enc = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function getStoredUser(email) {
  const key = 'citog_user:' + email.toLowerCase().trim();
  try {
    if (window.storage?.get) {
      const result = await window.storage.get(key, true);
      return result?.value ? JSON.parse(result.value) : null;
    }
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    return null;
  }
}
async function setStoredUser(email, record) {
  const key = 'citog_user:' + email.toLowerCase().trim();
  try {
    if (window.storage?.set) {
      const result = await window.storage.set(key, JSON.stringify(record), true);
      return !!result;
    }
    window.localStorage.setItem(key, JSON.stringify(record));
    return true;
  } catch (err) {
    return false;
  }
}

const SYSTEM_PROMPT = "You are CITOG AI, the friendly and knowledgeable virtual assistant on the personal portfolio website of Celestine Akinyemi (brand name: CITOG Developer), a Software Engineer and Frontend Developer.\n\nAbout Celestine:\n- Specializes in frontend development: HTML5, CSS3, JavaScript (ES6+), React.js, responsive design, and performance optimization.\n- Also comfortable with Node.js, REST APIs, Git/GitHub, and modern UI/UX implementation.\n- Offers web app development, responsive website design, UI/UX implementation, performance optimization, API integration, and website maintenance.\n- Open to freelance projects and full-time opportunities.\n- Contact: WhatsApp +234 813 842 7385, email celestineakinyemi358@gmail.com, plus LinkedIn and GitHub linked in the Contact section of this site.\n\nAnswer the specific question the visitor asked, not just its general topic. Put the direct answer first, then add only relevant context. Use conversation history to resolve follow-up questions. Keep replies concise (usually 2-4 sentences), warm, and professional. Do not add a contact pitch unless it helps answer the question. Do not invent project names, clients, years of experience, location, pricing, or availability dates; clearly say when a detail is not provided and point to the Contact section if the visitor needs confirmation.";

/* ================= TOASTS ================= */
function showToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4200);
}

/* ================= NAV / MOBILE MENU ================= */
function toggleMobileMenu() {
  const navLinks = document.getElementById('navLinks');
  const navActions = document.getElementById('navActions');
  const hamburger = document.getElementById('hamburger');
  const isOpen = navLinks.classList.toggle('active');
  navActions.classList.toggle('active', isOpen);
  hamburger.setAttribute('aria-expanded', String(isOpen));
}
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    document.getElementById('navLinks').classList.remove('active');
    document.getElementById('navActions').classList.remove('active');
  });
});

function setSiteAccess(isAuthenticated, user) {
  siteAuthenticated = isAuthenticated;
  document.getElementById('main-content').classList.toggle('site-locked', !isAuthenticated);
  document.getElementById('login-submit').hidden = isAuthenticated;
  document.getElementById('signup-submit').hidden = isAuthenticated;
  document.getElementById('navUserArea').classList.toggle('active', isAuthenticated);
  if (user) document.getElementById('navUserGreeting').textContent = 'Hi, ' + user.name.split(' ')[0];
}
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
  document.getElementById('backToTop').classList.toggle('visible', window.scrollY > 500);
});

/* ================= SCROLL REVEAL ================= */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
}, { threshold: 0.12 });
document.querySelectorAll('.fade-in').forEach(el => revealObserver.observe(el));

/* ================= AUTH MODAL ================= */
function openAuthModal(mode) {
  pendingMode = mode;
  document.getElementById('authOverlay').classList.add('active');
  document.body.classList.add('modal-open');
  clearAuthErrors();
  if (isVerifiedHuman) {
    showAuthStep(mode);
  } else {
    showAuthStep('verify');
  }
}
function closeAuthModal() {
  if (!siteAuthenticated) return;
  document.getElementById('authOverlay').classList.remove('active');
  document.body.classList.remove('modal-open');
}
function showAuthStep(step) {
  document.querySelectorAll('.auth-step').forEach(el => el.classList.add('auth-step-hidden'));
  document.getElementById('step-' + step).classList.remove('auth-step-hidden');
}
function proceedAfterVerify() {
  showAuthStep(pendingMode);
}
function clearAuthErrors() {
  const loginErr = document.getElementById('loginError');
  const signupErr = document.getElementById('signupError');
  if (loginErr) loginErr.textContent = '';
  if (signupErr) signupErr.textContent = '';
}
document.getElementById('authOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'authOverlay') closeAuthModal();
});
/* ================= SLIDER CAPTCHA ================= */
const sliderTrack = document.getElementById('sliderTrack');
const sliderHandle = document.getElementById('sliderHandle');
const sliderFill = document.getElementById('sliderFill');
const sliderText = document.getElementById('sliderText');
const verifyContinueBtn = document.getElementById('verifyContinueBtn');
let dragging = false;

sliderHandle.addEventListener('pointerdown', (e) => {
  if (isVerifiedHuman) return;
  dragging = true;
  sliderHandle.setPointerCapture(e.pointerId);
});
sliderHandle.addEventListener('pointermove', (e) => {
  if (!dragging || isVerifiedHuman) return;
  const trackRect = sliderTrack.getBoundingClientRect();
  const handleWidth = sliderHandle.offsetWidth;
  const maxLeft = trackRect.width - handleWidth - 6;
  let newLeft = e.clientX - trackRect.left - handleWidth / 2;
  newLeft = Math.max(0, Math.min(newLeft, maxLeft));
  sliderHandle.style.left = newLeft + 'px';
  sliderFill.style.width = (newLeft + handleWidth) + 'px';
  const percent = maxLeft > 0 ? (newLeft / maxLeft) * 100 : 0;
  if (percent >= 90) completeVerification();
});
sliderHandle.addEventListener('pointerup', () => {
  dragging = false;
  if (!isVerifiedHuman) {
    sliderHandle.style.left = '3px';
    sliderFill.style.width = '0px';
  }
});
function completeVerification() {
  isVerifiedHuman = true;
  dragging = false;
  const trackRect = sliderTrack.getBoundingClientRect();
  sliderHandle.style.left = (trackRect.width - sliderHandle.offsetWidth - 6) + 'px';
  sliderFill.style.width = '100%';
  sliderTrack.classList.add('verified');
  sliderText.textContent = "Verified — you're human!";
  verifyContinueBtn.disabled = false;
}

/* ================= SIGNUP / LOGIN / FORGOT ================= */
async function handleSignup(event) {
  event.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim().toLowerCase();
  const password = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;
  const errorEl = document.getElementById('signupError');
  const submitBtn = document.querySelector('#signupFormEl button[type="submit"]');
  errorEl.textContent = '';

  if (password.length < 8) { errorEl.textContent = 'Password must be at least 8 characters.'; return; }
  if (password !== confirm) { errorEl.textContent = 'Passwords do not match.'; return; }

  submitBtn.disabled = true;
  const originalLabel = submitBtn.textContent;
  submitBtn.textContent = 'Creating account...';
  try {
    const existing = await getStoredUser(email);
    if (existing) { errorEl.textContent = 'An account with this email already exists.'; return; }

    const passwordHash = await hashPassword(password);
    const saved = await setStoredUser(email, { name, email, passwordHash, createdAt: Date.now() });
    if (!saved) throw new Error('Storage write failed');

    document.getElementById('signupFormEl').reset();
    showToast('Account created! Please log in.');
    showAuthStep('login');
  } catch (err) {
    errorEl.textContent = 'Something went wrong creating your account. Please try again.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  const submitBtn = document.querySelector('#loginFormEl button[type="submit"]');
  errorEl.textContent = '';

  submitBtn.disabled = true;
  const originalLabel = submitBtn.textContent;
  submitBtn.textContent = 'Signing in...';
  try {
    const user = await getStoredUser(email);
    if (!user) { errorEl.textContent = 'No account found with this email — please sign up first.'; return; }

    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.passwordHash) { errorEl.textContent = 'Incorrect password. Please try again.'; return; }

    currentUser = user;
    document.getElementById('loginFormEl').reset();
    setSiteAccess(true, user);
    closeAuthModal();
    showToast('Welcome back, ' + user.name.split(' ')[0] + '!');
  } catch (err) {
    errorEl.textContent = 'Something went wrong signing in. Please try again.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
}

function handleForgotPassword(event) {
  event.preventDefault();
  const email = document.getElementById('forgotEmail').value.trim();
  resetEmail = email;
  document.getElementById('resetSentMessage').textContent =
    'If an account exists for ' + email + ', we\'ve sent password reset instructions. Since this preview has no real inbox to deliver to, continue below to set your new password directly.';
  document.getElementById('forgotFormEl').reset();
  showAuthStep('reset-sent');
}

async function handleResetPassword(event) {
  event.preventDefault();
  const password = document.getElementById('resetPassword').value;
  const confirm = document.getElementById('resetConfirm').value;
  const errorEl = document.getElementById('resetError');
  const submitBtn = document.querySelector('#resetFormEl button[type="submit"]');
  errorEl.textContent = '';

  if (password.length < 8) { errorEl.textContent = 'Password must be at least 8 characters.'; return; }
  if (password !== confirm) { errorEl.textContent = 'Passwords do not match.'; return; }

  submitBtn.disabled = true;
  const originalLabel = submitBtn.textContent;
  submitBtn.textContent = 'Resetting...';
  try {
    const user = await getStoredUser(resetEmail);
    if (!user) { errorEl.textContent = "We couldn't find an account for that email. Please check the address or sign up."; return; }

    user.passwordHash = await hashPassword(password);
    const saved = await setStoredUser(resetEmail, user);
    if (!saved) throw new Error('Storage write failed');

    document.getElementById('resetFormEl').reset();
    showToast('Password reset! Please log in with your new password.');
    showAuthStep('login');
  } catch (err) {
    errorEl.textContent = 'Something went wrong resetting your password. Please try again.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
}

function handleSocialLogin(provider) {
  const user = {
    name: provider + ' Visitor',
    email: provider.toLowerCase() + '.authenticated@citog.dev'
  };
  currentUser = user;
  setSiteAccess(true, user);
  closeAuthModal();
  showToast('Authenticated with ' + provider + '.');
}
function updateNavForLoggedInUser() {
  setSiteAccess(true, currentUser);
}
function handleLogout() {
  currentUser = null;
  setSiteAccess(false);
  openAuthModal('login');
  showAuthStep('login');
  showToast("You've been logged out.");
}

/* ================= CONTACT FORM (Formspree) ================= */
async function handleContactForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const status = document.getElementById('contactFormStatus');
  const originalLabel = submitButton.textContent;

  status.hidden = true;
  status.textContent = '';
  status.classList.remove('success', 'error');
  submitButton.disabled = true;
  submitButton.textContent = 'Sending...';

  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      let errorMessage = "Your message couldn't be sent. Please check the form and try again.";
      try {
        const result = await response.json();
        if (result.errors?.length) {
          errorMessage = result.errors.map(error => error.message).join(' ');
        }
      } catch (err) {
        // Keep the helpful default when the service response isn't JSON.
      }
      throw new Error(errorMessage);
    }

    form.reset();
    status.textContent = "Thanks, your message has been sent. I'll get back to you soon.";
    status.classList.add('success');
  } catch (err) {
    status.textContent = err.message || 'A network error prevented your message from being sent. Please try again.';
    status.classList.add('error');
  } finally {
    status.hidden = false;
    submitButton.disabled = false;
    submitButton.textContent = originalLabel;
  }
}
  

/* ================= LINKEDIN VIDEO FEED ================= */
const LINKEDIN_VIDEO_FEED_URL = '/api/linkedin/videos';
const LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/celestine-akinyemi-78641a400';
let linkedinVideos = [];
let featuredVideo = null;

function toggleVideoRail() {
  const rail = document.getElementById('linkedinVideoRail');
  const toggle = document.querySelector('.video-rail-toggle');
  const isOpen = rail.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', String(isOpen));
}

function openFeaturedVideo() {
  if (featuredVideo?.url) {
    window.open(featuredVideo.url, '_blank', 'noopener');
    return;
  }
  window.open(LINKEDIN_PROFILE_URL, '_blank', 'noopener');
}

function renderLinkedInVideo(video) {
  if (!video) return;
  featuredVideo = video;
  document.getElementById('featuredVideoTitle').textContent = video.title || 'Latest project walkthrough';
  document.getElementById('featuredVideoHeading').textContent = video.title || 'Project Walkthrough';
  document.getElementById('featuredVideoDescription').textContent = video.description || 'Watch the latest project update from LinkedIn.';
  document.getElementById('featuredVideoStatus').textContent = video.publishedAt ? 'Published ' + new Date(video.publishedAt).toLocaleDateString() : 'Latest LinkedIn post';
}

function renderLinkedInVideoList() {
  const list = document.getElementById('linkedinVideoList');
  if (!linkedinVideos.length) return;
  list.innerHTML = linkedinVideos.map((video, index) => '<button class="video-rail-item" type="button" data-video-index="' + index + '"><span class="video-rail-number">' + String(index + 1).padStart(2, '0') + '</span><span><strong>' + escapeHtml(video.title || 'LinkedIn video') + '</strong><small>' + escapeHtml(video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : 'Published on LinkedIn') + '</small></span></button>').join('');
  list.querySelectorAll('[data-video-index]').forEach((button) => button.addEventListener('click', () => renderLinkedInVideo(linkedinVideos[Number(button.dataset.videoIndex)])));
}

async function loadLinkedInVideos() {
  try {
    const response = await fetch(LINKEDIN_VIDEO_FEED_URL, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('LinkedIn feed unavailable');
    const payload = await response.json();
    linkedinVideos = Array.isArray(payload) ? payload : payload.videos || [];
    renderLinkedInVideo(linkedinVideos[0]);
    renderLinkedInVideoList();
  } catch (error) {
    document.getElementById('featuredVideoStatus').textContent = 'Connect /api/linkedin/videos to sync new LinkedIn posts automatically.';
  }
}

loadLinkedInVideos();
setInterval(loadLinkedInVideos, 300000);

/* ================= AI CHAT ================= */
function toggleAIChat() {
  aiChatOpen = !aiChatOpen;
  document.getElementById('aiChatPanel').classList.toggle('active', aiChatOpen);
  document.getElementById('aiFab').style.display = aiChatOpen ? 'none' : 'flex';
  if (aiChatOpen && aiMessages.length === 0) {
    appendMessage('ai', "Hi there! I'm CITOG AI. Ask me anything about Celestine's skills, services, or how to start a project together.");
  }
  if (aiChatOpen) document.getElementById('aiInput').focus();
}
function appendMessage(role, text) {
  const container = document.getElementById('aiMessages');
  const bubble = document.createElement('div');
  bubble.className = 'ai-msg ' + role;
  bubble.textContent = text;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}
function showTypingIndicator() {
  const container = document.getElementById('aiMessages');
  const el = document.createElement('div');
  el.className = 'typing-indicator';
  el.id = 'typingIndicator';
  el.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}
function hideTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}
function fallbackReply(text) {
  const question = text.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9+@.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const asks = (...terms) => terms.some(term => question.includes(term));

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(question)) {
    return "Hi! I'm CITOG AI. What would you like to know about Celestine's skills, services, or working together?";
  }
  if (asks('whatsapp', 'phone number', 'call', 'email', 'contact', 'reach', 'hire')) {
    if (asks('whatsapp', 'phone number', 'call')) return "You can reach Celestine on WhatsApp at +234 813 842 7385. The email and social links are also in the Contact section.";
    if (asks('email')) return "You can email Celestine at celestineakinyemi358@gmail.com. WhatsApp and social links are in the Contact section.";
    return "You can contact Celestine by WhatsApp at +234 813 842 7385 or email at celestineakinyemi358@gmail.com. LinkedIn and GitHub are linked in the Contact section.";
  }
  if (asks('available', 'availability', 'freelance', 'full-time', 'full time', 'part-time', 'part time')) {
    return "Celestine is open to freelance projects and full-time opportunities. For current availability and project timing, please ask directly through the Contact section.";
  }
  if (asks('price', 'pricing', 'cost', 'rate', 'budget', 'charge')) {
    return "Pricing is not specified on the site and depends on the project scope. Share the project details through the Contact section to get a quote from Celestine.";
  }
  if (asks('what does he do', 'what does celestine do', 'what do you do', 'profession', 'occupation', 'job title')) {
    return "Celestine is a Software Engineer and Frontend Developer. He builds responsive websites and web apps, and also works on UI/UX implementation, API integration, and performance optimization.";
  }
  if (asks('service', 'offer', 'build', 'website', 'web app', 'web application', 'can you make', 'can you create')) {
    return "Celestine offers responsive website and web app development, UI/UX implementation, API integration, performance optimization, and website maintenance. Send the project requirements through the Contact section to discuss the details.";
  }
  if (asks('skill', 'technology', 'technologies', 'tech stack', 'stack', 'framework', 'programming language', 'react', 'javascript', 'html', 'css', 'node.js', 'nodejs', 'rest api', 'git', 'know')) {
    return "Celestine's core stack includes HTML5, CSS3, JavaScript, and React.js, with experience in responsive design and performance optimization. He also works with Node.js, REST APIs, and Git/GitHub.";
  }
  if (asks('experience', 'years', 'background', 'who is', 'about celestine', 'tell me about')) {
    return "Celestine Akinyemi, known as CITOG Developer, is a Software Engineer and Frontend Developer focused on building responsive, polished web experiences. The site doesn't specify a number of years of experience.";
  }
  if (asks('project', 'portfolio', 'previous work', 'past work', 'examples')) {
    return "You can browse the portfolio's Projects section to see the work showcased on this site. The site doesn't provide verified project details in this chat, so I won't guess at names or clients.";
  }
  if (asks('where', 'location', 'based')) {
    return "Celestine's location isn't specified on this site. You can contact him through the Contact section to ask about location or remote work.";
  }
  if (asks('thank', 'thanks')) return "You're welcome! Is there anything else you'd like to know about Celestine's work?";
  return "I couldn't identify the specific detail you're asking for, and I don't want to guess. I can help with Celestine's skills, services, availability, project inquiries, or contact details; for anything else, please use the Contact section.";
}
async function sendAIMessage() {
  const input = document.getElementById('aiInput');
  const sendBtn = document.getElementById('aiSendBtn');
  const text = input.value.trim();
  if (!text) return;
  appendMessage('user', text);
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;
  showTypingIndicator();
  aiMessages.push({ role: 'user', content: text });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: aiMessages
      })
    });
    if (!response.ok) throw new Error('Request failed');
    const data = await response.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    const reply = textBlock ? textBlock.text : fallbackReply(text);
    hideTypingIndicator();
    appendMessage('ai', reply);
    aiMessages.push({ role: 'assistant', content: reply });
  } catch (err) {
    hideTypingIndicator();
    const reply = fallbackReply(text);
    appendMessage('ai', reply);
    aiMessages.push({ role: 'assistant', content: reply });
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

/* ================= LIVE GITHUB PROJECTS =================
   Fetches public repos from the GitHub REST API (no auth needed) and
   renders them as project cards. Push a repo, give it a description,
   and it shows up here on the next page load — nothing to edit by hand.
   Forks and the special profile-readme repo are skipped automatically. */
const GITHUB_USERNAME = 'celestineakinyemi358';
const MOCKUP_LAYOUTS = ['layout-sidebar', 'layout-grid', 'layout-list', 'layout-bars'];
const MOCKUP_ACCENTS = ['#C9972F', '#6D5FF5', '#E0554F', '#29D9C8'];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function mockupContentFor(layout) {
  if (layout === 'layout-sidebar') return '<div class="m-side"></div><div class="m-main"><div class="m-block" style="height:38%;"></div><div class="m-row"><div></div><div></div><div></div></div></div>';
  if (layout === 'layout-grid') return '<div class="m-cell accent"></div><div class="m-cell"></div><div class="m-cell"></div><div class="m-cell"></div><div class="m-cell accent"></div><div class="m-cell"></div>';
  if (layout === 'layout-list') return '<div class="m-line"><span class="m-dot"></span></div><div class="m-line"><span class="m-dot"></span></div><div class="m-line"><span class="m-dot"></span></div>';
  return '<div class="m-bar" style="height:40%;"></div><div class="m-bar" style="height:75%;"></div><div class="m-bar" style="height:55%;"></div><div class="m-bar" style="height:85%;"></div>';
}

function buildProjectCard(repo, index) {
  const layout = MOCKUP_LAYOUTS[index % MOCKUP_LAYOUTS.length];
  const accent = MOCKUP_ACCENTS[index % MOCKUP_ACCENTS.length];
  const title = repo.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const desc = repo.description ? escapeHtml(repo.description) : 'No description yet — add one on GitHub to have it appear here.';
  const tags = [];
  if (repo.language) tags.push(repo.language);
  (repo.topics || []).forEach(t => tags.push(t));
  const tagHtml = tags.slice(0, 4).map(t => '<span class="tag">' + escapeHtml(t) + '</span>').join('');
  let liveDemoUrl = '';
  if (repo.homepage && repo.homepage.trim()) {
    try {
      const homepage = new URL(repo.homepage.trim());
      if (homepage.protocol === 'http:' || homepage.protocol === 'https:') {
        liveDemoUrl = homepage.href;
      }
    } catch (err) {
      liveDemoUrl = '';
    }
  }

  return '<article class="project-card">' +
    '<div class="project-mockup ' + layout + '" style="--m-accent:' + accent + ';">' +
      '<div class="mockup-dots"><span></span><span></span><span></span></div>' +
      '<div class="mockup-content">' + mockupContentFor(layout) + '</div>' +
    '</div>' +
    '<div class="project-body">' +
      '<h3>' + escapeHtml(title) + '</h3>' +
      '<p>' + desc + '</p>' +
      '<div class="tag-row">' + tagHtml + '</div>' +
      '<div class="project-actions">' +
        (liveDemoUrl
          ? '<a class="project-action project-action-demo" href="' + escapeHtml(liveDemoUrl) + '" target="_blank" rel="noopener noreferrer">Live demo <span aria-hidden="true">\u2197</span></a>'
          : '<span class="project-action project-action-unavailable" aria-disabled="true">Demo unavailable</span>') +
        '<a class="project-action project-action-code" href="' + escapeHtml(repo.html_url) + '" target="_blank" rel="noopener noreferrer">View code <span aria-hidden="true">\u2197</span></a>' +
      '</div>' +
    '</div>' +
  '</article>';
}

async function loadGithubProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;
  try {
    const repos = [];
    for (let page = 1; ; page += 1) {
      const res = await fetch('https://api.github.com/users/' + GITHUB_USERNAME + '/repos?sort=pushed&per_page=100&page=' + page);
      if (!res.ok) throw new Error('GitHub API request failed');
      const pageRepos = await res.json();
      repos.push(...pageRepos);
      if (pageRepos.length < 100) break;
    }

    const projects = repos
      .filter(r => !r.fork && r.name.toLowerCase() !== GITHUB_USERNAME.toLowerCase())
      .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

    if (projects.length === 0) {
      grid.innerHTML = '<p class="projects-empty">No public repositories found yet — push one to GitHub and it will appear here automatically.</p>';
      return;
    }
    grid.innerHTML = projects.map(buildProjectCard).join('');
  } catch (err) {
    grid.innerHTML = '<p class="projects-empty">Couldn\'t load live projects from GitHub right now. <a href="https://github.com/' + GITHUB_USERNAME + '" target="_blank" rel="noopener">View them directly on GitHub &rarr;</a></p>';
  }
}
loadGithubProjects();

setSiteAccess(false);
document.getElementById('authOverlay').classList.add('active');
showAuthStep('verify');
