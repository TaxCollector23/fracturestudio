/* auth.js - Firebase authentication and saved work helpers for Fracture Studio */
(function () {
  'use strict';

  const FIREBASE_VERSION = '12.13.0';
  const FIREBASE_APP_CDN = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/firebase-app.js';
  const FIREBASE_AUTH_CDN = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/firebase-auth.js';
  const FIREBASE_FIRESTORE_CDN = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/firebase-firestore.js';
  const RETURN_PATH_KEY = 'fracture_auth_return';
  const GUEST_ACCESS_KEY = 'fracture_guest_access';
  const ACTIVE_WORKSPACE_KEY = 'fracture_active_workspace';
  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: 'AIzaSyCfvIx3BFLSW3jM7UVI55xEUWU6ruw_KGQ',
    authDomain: 'gen-lang-client-0002047847.firebaseapp.com',
    projectId: 'gen-lang-client-0002047847',
    storageBucket: 'gen-lang-client-0002047847.firebasestorage.app',
    messagingSenderId: '275316382012',
    appId: '1:275316382012:web:a14a8dbd90690cddcfa639'
  };

  const KEYS = {
    projects: 'fracture_auth_projects',
    preferences: 'fracture_auth_preferences'
  };

  const DEFAULT_PREFERENCES = {
    feedbackDepth: 'balanced',
    feedbackTone: 'direct',
    citationStyle: 'mla',
    emailUpdates: false,
    saveReports: true
  };

  let configPromise = null;
  let servicesPromise = null;
  let authReadyPromise = null;
  let authReadyResolve = null;
  let authObserverBound = false;
  let cloudReady = null;
  let settingsListenersBound = false;

  function rememberReturnPath(destination) {
    const path = destination || (window.location.pathname + window.location.search);
    if (path && path !== '/auth/callback' && path !== '/auth-callback.html') {
      try { localStorage.setItem(RETURN_PATH_KEY, path); } catch (_) {}
    }
  }

  function rememberCurrentPathIfNoDestination() {
    try {
      if (!localStorage.getItem(RETURN_PATH_KEY)) rememberReturnPath();
    } catch (_) {
      rememberReturnPath();
    }
  }

  function consumeReturnPath() {
    try {
      const path = localStorage.getItem(RETURN_PATH_KEY);
      localStorage.removeItem(RETURN_PATH_KEY);
      if (path && path.startsWith('/') && !path.startsWith('//')) return path;
    } catch (_) {}
    return null;
  }

  function hasGuestAccess() {
    try {
      return sessionStorage.getItem(GUEST_ACCESS_KEY) === 'true';
    } catch (_) {
      return false;
    }
  }

  function continueWithoutEmail() {
    try { sessionStorage.setItem(GUEST_ACCESS_KEY, 'true'); } catch (_) {}
    const modal = document.getElementById('fractureAuthModal');
    if (modal) modal.classList.add('hidden');
    const returnPath = consumeReturnPath();
    if (returnPath && isStudioHref(returnPath) && !isStudioPage()) {
      window.location.href = returnPath;
    }
    return true;
  }

  async function loadConfig() {
    if (configPromise) return configPromise;
    configPromise = fetch('/api/public-config', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Configuration request failed.');
        return response.json();
      })
      .then(function (config) {
        return config.firebaseConfig || DEFAULT_FIREBASE_CONFIG;
      })
      .catch(function () {
        return DEFAULT_FIREBASE_CONFIG;
      });
    return configPromise;
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function getActiveWorkspace() {
    return readJson(ACTIVE_WORKSPACE_KEY, null);
  }

  function setActiveWorkspace(workspace) {
    const next = workspace && typeof workspace === 'object'
      ? Object.assign({}, workspace, { updated: workspace.updated || new Date().toISOString() })
      : null;
    if (!next) {
      try { localStorage.removeItem(ACTIVE_WORKSPACE_KEY); } catch (_) {}
      return null;
    }
    writeJson(ACTIVE_WORKSPACE_KEY, next);
    return next;
  }

  function saveLocalProject(draft, analysis) {
    const now = new Date().toISOString();
    const list = readJson(KEYS.projects, []);
    const project = {
      id: 'browser-' + Date.now(),
      title: titleFromDraft(draft),
      draft: draft || '',
      analysis: analysis || null,
      created: now,
      updated: now,
      mode: 'browser'
    };
    const next = [project].concat(Array.isArray(list) ? list : [])
      .filter(function (item, index, items) {
        return index === items.findIndex(function (candidate) {
          return candidate.id === item.id || (candidate.draft === item.draft && candidate.updated === item.updated);
        });
      })
      .slice(0, 30);
    writeJson(KEYS.projects, next);
    return setActiveWorkspace(project);
  }

  function friendlyAuthError(error) {
    const code = error && error.code;
    const messages = {
      'auth/email-already-in-use': 'An account already exists for that email. Sign in instead.',
      'auth/invalid-credential': 'The email or password was not accepted.',
      'auth/invalid-email': 'Enter a valid email address.',
      'auth/missing-email': 'Enter the email address for your account.',
      'auth/popup-blocked': 'Your browser blocked Google sign-in. Allow the popup and try again.',
      'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
      'auth/unauthorized-domain': 'This site address is not approved for sign-in yet.',
      'auth/user-not-found': 'No account was found for that email address.',
      'auth/weak-password': 'Use a password with at least 8 characters.',
      'auth/network-request-failed': 'The sign-in service could not be reached. Check your connection and try again.'
    };
    return new Error(messages[code] || (error && error.message) || 'Account request failed.');
  }

  function normalizedUser(user) {
    if (!user) return null;
    const providerId = user.providerData && user.providerData[0] && user.providerData[0].providerId;
    return {
      id: user.uid,
      uid: user.uid,
      email: user.email || '',
      name: user.displayName || '',
      provider: providerId === 'google.com' ? 'google' : 'email'
    };
  }

  function bindAuthObserver(services) {
    if (authObserverBound) return;
    authObserverBound = true;
    authReadyPromise = new Promise(function (resolve) {
      authReadyResolve = resolve;
    });
    services.authModule.onAuthStateChanged(services.auth, async function (firebaseUser) {
      if (firebaseUser) {
        try { await syncProfile(firebaseUser); } catch (_) {}
        const modal = document.getElementById('fractureAuthModal');
        if (modal) modal.classList.add('hidden');
        const returnPath = consumeReturnPath();
        if (returnPath && isStudioHref(returnPath) && !isStudioPage()) {
          window.location.href = returnPath;
        }
      }
      if (authReadyResolve) {
        authReadyResolve();
        authReadyResolve = null;
      }
    });
  }

  async function getServices() {
    if (servicesPromise) return servicesPromise;
    servicesPromise = Promise.all([
      loadConfig(),
      import(FIREBASE_APP_CDN),
      import(FIREBASE_AUTH_CDN),
      import(FIREBASE_FIRESTORE_CDN)
    ]).then(async function (loaded) {
      const config = loaded[0];
      const appModule = loaded[1];
      const authModule = loaded[2];
      const firestoreModule = loaded[3];
      const firebaseApp = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(config);
      const auth = authModule.getAuth(firebaseApp);
      const db = firestoreModule.getFirestore(firebaseApp);
      await authModule.setPersistence(auth, authModule.browserLocalPersistence);
      const services = {
        auth: auth,
        db: db,
        authModule: authModule,
        firestoreModule: firestoreModule
      };
      bindAuthObserver(services);
      cloudReady = true;
      return services;
    }).catch(function (error) {
      cloudReady = false;
      throw error;
    });
    return servicesPromise;
  }

  async function waitForAuth() {
    const services = await getServices();
    if (authReadyPromise) await authReadyPromise;
    return services;
  }

  function titleFromDraft(draft) {
    const text = String(draft || '').replace(/\s+/g, ' ').trim();
    if (!text) return 'Untitled argument';
    return text.length > 70 ? text.slice(0, 67) + '...' : text;
  }

  async function syncProfile(firebaseUser) {
    if (!firebaseUser || !firebaseUser.uid) return null;
    const services = await getServices();
    const profileRef = services.firestoreModule.doc(services.db, 'users', firebaseUser.uid);
    const existing = await services.firestoreModule.getDoc(profileRef);
    const profile = {
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || '',
      provider: normalizedUser(firebaseUser).provider,
      lastSeen: services.firestoreModule.serverTimestamp()
    };
    if (!existing.exists()) profile.createdAt = services.firestoreModule.serverTimestamp();
    await services.firestoreModule.setDoc(profileRef, profile, { merge: true });
    return normalizedUser(firebaseUser);
  }

  async function getUser() {
    try {
      const services = await waitForAuth();
      return normalizedUser(services.auth.currentUser);
    } catch (_) {
      cloudReady = false;
      return null;
    }
  }

  async function signInGoogle() {
    rememberCurrentPathIfNoDestination();
    try {
      const services = await getServices();
      const provider = new services.authModule.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await services.authModule.signInWithPopup(services.auth, provider);
      await syncProfile(credential.user);
      return normalizedUser(credential.user);
    } catch (error) {
      throw friendlyAuthError(error);
    }
  }

  async function signInEmail(email, password) {
    const cleanEmail = String(email || '').trim();
    if (!cleanEmail) throw new Error('Enter an email address.');
    if (!password) throw new Error('Enter your password.');
    try {
      const services = await getServices();
      const credential = await services.authModule.signInWithEmailAndPassword(services.auth, cleanEmail, password);
      await syncProfile(credential.user);
      return normalizedUser(credential.user);
    } catch (error) {
      throw friendlyAuthError(error);
    }
  }

  async function signUpEmail(name, email, password) {
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim();
    if (!cleanEmail) throw new Error('Enter an email address.');
    if (String(password || '').length < 8) throw new Error('Use a password with at least 8 characters.');
    try {
      const services = await getServices();
      const credential = await services.authModule.createUserWithEmailAndPassword(services.auth, cleanEmail, password);
      if (cleanName) {
        await services.authModule.updateProfile(credential.user, { displayName: cleanName });
      }
      await syncProfile(credential.user);
      return normalizedUser(credential.user);
    } catch (error) {
      throw friendlyAuthError(error);
    }
  }

  async function sendPasswordReset(email) {
    const cleanEmail = String(email || '').trim();
    if (!cleanEmail) throw new Error('Enter your email address first.');
    try {
      const services = await getServices();
      await services.authModule.sendPasswordResetEmail(services.auth, cleanEmail);
      return true;
    } catch (error) {
      throw friendlyAuthError(error);
    }
  }

  async function signOut() {
    const services = await getServices();
    await services.authModule.signOut(services.auth);
    return true;
  }

  async function saveProject(draft, analysis) {
    const user = await getUser();
    if (user) {
      try {
        const services = await getServices();
        const now = services.firestoreModule.serverTimestamp();
        const result = await services.firestoreModule.addDoc(
          services.firestoreModule.collection(services.db, 'users', user.id, 'projects'),
          {
            title: titleFromDraft(draft),
            draft: draft || '',
            analysis: analysis || null,
            createdAt: now,
            updatedAt: now
          }
        );
        return setActiveWorkspace({
          id: result.id,
          title: titleFromDraft(draft),
          draft: draft || '',
          analysis: analysis || null,
          updated: new Date().toISOString(),
          mode: 'cloud'
        });
      } catch (_) {}
    }
    return saveLocalProject(draft, analysis);
  }

  async function listProjects() {
    const user = await getUser();
    if (user) {
      try {
        const services = await getServices();
        const query = services.firestoreModule.query(
          services.firestoreModule.collection(services.db, 'users', user.id, 'projects'),
          services.firestoreModule.orderBy('updatedAt', 'desc'),
          services.firestoreModule.limit(50)
        );
        const results = await services.firestoreModule.getDocs(query);
        return results.docs.map(function (entry) {
          const project = entry.data();
          const updatedAt = project.updatedAt && typeof project.updatedAt.toDate === 'function'
            ? project.updatedAt.toDate().toISOString()
            : null;
          return Object.assign({}, project, {
            id: entry.id,
            updated: updatedAt,
            mode: 'cloud'
          });
        });
      } catch (_) {}
    }
    const localProjects = readJson(KEYS.projects, []);
    const active = getActiveWorkspace();
    const combined = [];
    if (active && active.draft) combined.push(Object.assign({ mode: 'browser' }, active));
    if (Array.isArray(localProjects)) {
      localProjects.forEach(function (project) {
        if (project && project.draft && !combined.some(function (item) { return item.id === project.id; })) {
          combined.push(Object.assign({ mode: 'browser' }, project));
        }
      });
    }
    return combined;
  }

  async function getProject(projectId) {
    const cleanId = String(projectId || '').trim();
    if (!cleanId) return getActiveWorkspace();
    const user = await getUser();
    if (!user) {
      const localProjects = readJson(KEYS.projects, []);
      const found = Array.isArray(localProjects)
        ? localProjects.find(function (project) { return project.id === cleanId; })
        : null;
      return found ? setActiveWorkspace(Object.assign({ mode: 'browser' }, found)) : null;
    }
    try {
      const services = await getServices();
      const projectRef = services.firestoreModule.doc(services.db, 'users', user.id, 'projects', cleanId);
      const result = await services.firestoreModule.getDoc(projectRef);
      if (!result.exists()) return null;
      const project = result.data();
      const updatedAt = project.updatedAt && typeof project.updatedAt.toDate === 'function'
        ? project.updatedAt.toDate().toISOString()
        : null;
      return setActiveWorkspace(Object.assign({}, project, {
        id: result.id,
        updated: updatedAt,
        mode: 'cloud'
      }));
    } catch (_) {
      return null;
    }
  }

  async function getPreferences() {
    const localPreferences = Object.assign({}, DEFAULT_PREFERENCES, readJson(KEYS.preferences, {}));
    const user = await getUser();
    if (user) {
      try {
        const services = await getServices();
        const preferenceRef = services.firestoreModule.doc(services.db, 'users', user.id, 'settings', 'preferences');
        const result = await services.firestoreModule.getDoc(preferenceRef);
        if (result.exists()) {
          return Object.assign({}, DEFAULT_PREFERENCES, result.data());
        }
      } catch (_) {}
    }
    return localPreferences;
  }

  async function savePreferences(preferences) {
    const next = Object.assign({}, DEFAULT_PREFERENCES, preferences || {});
    writeJson(KEYS.preferences, next);
    const user = await getUser();
    if (user) {
      try {
        const services = await getServices();
        const preferenceRef = services.firestoreModule.doc(services.db, 'users', user.id, 'settings', 'preferences');
        await services.firestoreModule.setDoc(preferenceRef, next, { merge: true });
      } catch (_) {}
    }
    return next;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value;
  }

  function setChecked(id, value) {
    const element = document.getElementById(id);
    if (element) element.checked = Boolean(value);
  }

  function collectPreferences() {
    return {
      feedbackDepth: (document.getElementById('feedbackDepth') || {}).value || DEFAULT_PREFERENCES.feedbackDepth,
      feedbackTone: (document.getElementById('feedbackTone') || {}).value || DEFAULT_PREFERENCES.feedbackTone,
      citationStyle: (document.getElementById('citationStyle') || {}).value || DEFAULT_PREFERENCES.citationStyle,
      emailUpdates: Boolean((document.getElementById('emailUpdates') || {}).checked),
      saveReports: Boolean((document.getElementById('saveReports') || {}).checked)
    };
  }

  async function renderProjects() {
    const list = document.getElementById('savedProjectsList');
    if (!list) return;
    const projects = await listProjects();
    if (!projects.length) {
      list.innerHTML = '<div class="empty-state">No saved work yet.</div>';
      return;
    }

    list.innerHTML = projects.map(function (project) {
      const timestamp = project.updated || project.updated_at;
      const updated = timestamp ? new Date(timestamp).toLocaleString() : 'Saved in this browser';
      const title = (project.title || titleFromDraft(project.draft)).replace(/[&<>"']/g, function (character) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
      });
      return '<div class="saved-item">'
        + '<div><strong>' + title + '</strong><span>' + updated + '</span></div>'
        + '<span class="tag">' + (project.mode === 'browser' ? 'Browser' : 'Cloud') + '</span>'
        + '</div>';
    }).join('');
  }

  async function refreshAccountUI() {
    try { await getServices(); } catch (_) {}
    const user = await getUser();
    const modeLabel = cloudReady ? 'Cloud account ready' : 'Cloud account unavailable';
    setText('authMode', modeLabel);
    if (user) {
      setText('authStatus', 'Signed in');
      setText('accountEmail', user.email || 'No email on account');
      setText('accountProvider', user.provider || 'email');
    } else {
      setText('authStatus', 'Not signed in');
      setText('accountEmail', 'No account active');
      setText('accountProvider', modeLabel);
    }
  }

  function isStudioHref(href) {
    if (!href) return false;
    try {
      const url = new URL(href, window.location.href);
      return /\/studio(?:\/case)?$/.test(url.pathname)
        || /\/analyze$/.test(url.pathname)
        || /\/studio\.html$/.test(url.pathname)
        || /\/rebuttals(?:\.html)?$/.test(url.pathname);
    } catch (_) {
      return /studio\.html|\/studio|\/analyze|\/rebuttals/.test(href);
    }
  }

  function isStudioPage() {
    return isStudioHref(window.location.href);
  }

  function ensureAuthModal() {
    let modal = document.getElementById('fractureAuthModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'auth-modal-backdrop hidden';
    modal.id = 'fractureAuthModal';
    modal.innerHTML = ''
      + '<div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">'
      + '<button class="auth-close" id="authModalClose" type="button" aria-label="Close sign in">x</button>'
      + '<div class="label">Account Required</div>'
      + '<h2 id="authModalTitle">Sign in to use Fracture Studio.</h2>'
      + '<p id="authModalMessage">Save drafts, keep report history, and return to your work across sessions.</p>'
      + '<button class="btn-primary auth-wide" id="authModalGoogle" type="button">Continue with Google</button>'
      + '<div class="auth-divider"><span>or continue with email</span></div>'
      + '<div class="auth-email-fields">'
      + '<input id="authModalName" aria-label="Full name for new accounts" type="text" placeholder="Full name for new accounts" autocomplete="name" />'
      + '<input id="authModalEmail" aria-label="Email address" type="email" placeholder="you@example.com" autocomplete="email" />'
      + '<input id="authModalPassword" aria-label="Password" type="password" placeholder="Password" autocomplete="current-password" />'
      + '</div>'
      + '<div class="auth-email-actions">'
      + '<button class="btn-sm" id="authModalEmailSignIn" type="button">Sign In</button>'
      + '<button class="btn-sm" id="authModalEmailCreate" type="button">Create Account</button>'
      + '</div>'
      + '<button class="auth-reset-link" id="authModalPasswordReset" type="button">Forgot password?</button>'
      + '<div class="auth-divider auth-guest-divider"><span>or continue without email</span></div>'
      + '<button class="btn-sm auth-guest" id="authModalGuest" type="button">Continue as Guest</button>'
      + '<p class="auth-message" id="authModalStatus"></p>'
      + '</div>';
    document.body.appendChild(modal);

    const closeBtn = document.getElementById('authModalClose');
    const googleBtn = document.getElementById('authModalGoogle');
    const signInBtn = document.getElementById('authModalEmailSignIn');
    const createBtn = document.getElementById('authModalEmailCreate');
    const resetBtn = document.getElementById('authModalPasswordReset');
    const guestBtn = document.getElementById('authModalGuest');
    const nameInput = document.getElementById('authModalName');
    const emailInput = document.getElementById('authModalEmail');
    const passwordInput = document.getElementById('authModalPassword');

    closeBtn.addEventListener('click', function () {
      if (modal.dataset.required === 'true') return;
      modal.classList.add('hidden');
    });

    googleBtn.addEventListener('click', function () {
      setText('authModalStatus', 'Opening Google sign in...');
      signInGoogle().catch(function (error) {
        setText('authModalStatus', error.message || 'Google sign in could not start.');
      });
    });

    signInBtn.addEventListener('click', async function () {
      setText('authModalStatus', 'Signing in...');
      try {
        await signInEmail(emailInput.value, passwordInput.value);
        modal.classList.add('hidden');
      } catch (error) {
        setText('authModalStatus', error.message || 'Email sign in failed.');
      }
    });

    createBtn.addEventListener('click', async function () {
      setText('authModalStatus', 'Creating account...');
      try {
        await signUpEmail(nameInput.value, emailInput.value, passwordInput.value);
        modal.classList.add('hidden');
      } catch (error) {
        setText('authModalStatus', error.message || 'Account creation failed.');
      }
    });

    resetBtn.addEventListener('click', async function () {
      setText('authModalStatus', 'Requesting a reset email...');
      try {
        await sendPasswordReset(emailInput.value);
        setText('authModalStatus', 'Password reset email sent. Check your inbox and spam folder.');
      } catch (error) {
        setText('authModalStatus', error.message || 'Password reset email could not be sent.');
      }
    });

    guestBtn.addEventListener('click', function () {
      continueWithoutEmail();
    });
    return modal;
  }

  function showAuthModal(required, message) {
    const modal = ensureAuthModal();
    modal.dataset.required = required ? 'true' : 'false';
    const closeBtn = document.getElementById('authModalClose');
    if (closeBtn) closeBtn.style.display = required ? 'none' : '';
    setText('authModalMessage', message || 'Sign in to save your Fracture work and use the Studio.');
    setText('authModalStatus', '');
    modal.classList.remove('hidden');
    const emailInput = document.getElementById('authModalEmail');
    if (emailInput) emailInput.focus();
  }

  async function requireAuthForStudio() {
    const user = await getUser();
    if (user || hasGuestAccess()) return true;
    showAuthModal(true, 'Sign in to save cloud history, or continue as a guest to start immediately. Guest drafts are temporary.');
    return false;
  }

  async function initAuthGate() {
    ensureAuthModal();
    document.addEventListener('click', async function (event) {
      const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (!link || !isStudioHref(link.getAttribute('href'))) return;
      const user = await getUser();
      if (user || hasGuestAccess()) return;
      event.preventDefault();
      try {
        const destination = new URL(link.getAttribute('href'), window.location.href);
        rememberReturnPath(destination.pathname + destination.search);
      } catch (_) {
        rememberReturnPath('/studio');
      }
      showAuthModal(false, 'Sign in for cloud-saved drafts and report history, or continue as a guest to start immediately. Guest drafts are temporary.');
    }, true);

    if (isStudioPage()) {
      rememberReturnPath();
      await requireAuthForStudio();
    }
  }

  async function completeAuthCallback() {
    return getUser();
  }

  function setButtonBusy(button, busy, busyLabel) {
    if (!button) return;
    if (!button.dataset.readyLabel) button.dataset.readyLabel = button.textContent;
    button.disabled = Boolean(busy);
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
    button.textContent = busy && busyLabel ? busyLabel : button.dataset.readyLabel;
  }

  async function runSettingsAction(button, busyLabel, task) {
    setButtonBusy(button, true, busyLabel);
    try {
      await task();
    } catch (error) {
      setText('settingsMessage', error && error.message ? error.message : 'This action could not finish. Try again.');
    } finally {
      setButtonBusy(button, false);
    }
  }

  function bindSettingsActions() {
    if (settingsListenersBound) return;
    settingsListenersBound = true;
    const googleBtn = document.getElementById('googleSignInBtn');
    const signInBtn = document.getElementById('emailSignInBtn');
    const createBtn = document.getElementById('emailCreateBtn');
    const resetBtn = document.getElementById('passwordResetBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const savePrefsBtn = document.getElementById('savePrefsBtn');
    const refreshProjectsBtn = document.getElementById('refreshProjectsBtn');
    const clearLocalBtn = document.getElementById('clearLocalProjectsBtn');

    if (googleBtn) {
      googleBtn.addEventListener('click', function () {
        setText('settingsMessage', 'Opening Google sign in...');
        runSettingsAction(googleBtn, 'Opening Google...', async function () {
          await signInGoogle();
          setText('settingsMessage', 'Signed in with Google.');
          await refreshAccountUI();
          await renderProjects();
        });
      });
    }

    if (signInBtn) {
      signInBtn.addEventListener('click', function () {
        setText('settingsMessage', 'Signing in with email...');
        runSettingsAction(signInBtn, 'Signing in...', async function () {
          await signInEmail(
            (document.getElementById('emailInput') || {}).value || '',
            (document.getElementById('passwordInput') || {}).value || ''
          );
          setText('settingsMessage', 'Signed in.');
          await refreshAccountUI();
          await renderProjects();
        });
      });
    }

    if (createBtn) {
      createBtn.addEventListener('click', function () {
        setText('settingsMessage', 'Creating your email account...');
        runSettingsAction(createBtn, 'Creating account...', async function () {
          await signUpEmail(
            (document.getElementById('nameInput') || {}).value || '',
            (document.getElementById('emailInput') || {}).value || '',
            (document.getElementById('passwordInput') || {}).value || ''
          );
          setText('settingsMessage', 'Account created and signed in.');
          await refreshAccountUI();
          await renderProjects();
        });
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        setText('settingsMessage', 'Requesting a password reset email...');
        runSettingsAction(resetBtn, 'Requesting reset...', async function () {
          await sendPasswordReset((document.getElementById('emailInput') || {}).value || '');
          setText('settingsMessage', 'Password reset email sent. Check your inbox and spam folder.');
        });
      });
    }

    if (signOutBtn) {
      signOutBtn.addEventListener('click', function () {
        setText('settingsMessage', 'Signing out...');
        runSettingsAction(signOutBtn, 'Signing out...', async function () {
          await signOut();
          setText('settingsMessage', 'Signed out.');
          await refreshAccountUI();
          await renderProjects();
        });
      });
    }

    if (savePrefsBtn) {
      savePrefsBtn.addEventListener('click', function () {
        setText('settingsMessage', 'Saving your settings...');
        runSettingsAction(savePrefsBtn, 'Saving...', async function () {
          await savePreferences(collectPreferences());
          setText('settingsMessage', 'Settings saved.');
        });
      });
    }

    if (refreshProjectsBtn) {
      refreshProjectsBtn.addEventListener('click', function () {
        setText('settingsMessage', 'Refreshing work history...');
        runSettingsAction(refreshProjectsBtn, 'Refreshing...', async function () {
          await renderProjects();
          setText('settingsMessage', 'Work history refreshed.');
        });
      });
    }

    if (clearLocalBtn) {
      clearLocalBtn.addEventListener('click', function () {
        runSettingsAction(clearLocalBtn, 'Clearing...', async function () {
          try { localStorage.removeItem(KEYS.projects); } catch (_) {}
          setText('settingsMessage', 'Browser-saved work cleared.');
          await renderProjects();
        });
      });
    }
  }

  async function initAuthUI() {
    bindSettingsActions();
    await refreshAccountUI();
    const preferences = await getPreferences();
    setValue('feedbackDepth', preferences.feedbackDepth);
    setValue('feedbackTone', preferences.feedbackTone);
    setValue('citationStyle', preferences.citationStyle);
    setChecked('emailUpdates', preferences.emailUpdates);
    setChecked('saveReports', preferences.saveReports);
    await renderProjects();
  }

  window.FractureAuth = {
    initAuthUI: initAuthUI,
    getUser: getUser,
    saveProject: saveProject,
    listProjects: listProjects,
    getProject: getProject,
    getActiveWorkspace: getActiveWorkspace,
    setActiveWorkspace: setActiveWorkspace,
    signInGoogle: signInGoogle,
    signInEmail: signInEmail,
    signUpEmail: signUpEmail,
    sendPasswordReset: sendPasswordReset,
    signOut: signOut,
    getPreferences: getPreferences,
    savePreferences: savePreferences,
    hasGuestAccess: hasGuestAccess,
    continueWithoutEmail: continueWithoutEmail,
    initAuthGate: initAuthGate,
    showAuthModal: showAuthModal,
    requireAuthForStudio: requireAuthForStudio,
    completeAuthCallback: completeAuthCallback,
    consumeReturnPath: consumeReturnPath
  };
})();
