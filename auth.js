import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, updatePassword, deleteUser } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const auth = getAuth();
window.firebaseAuth = auth;
function setCurrentUser(user) {
  if (user) {
    window.currentUserUid = user.uid;
    window.currentUser = user;
    document.documentElement.dataset.user = user.uid;
  } else {
    window.currentUserUid = null;
    window.currentUser = null;
    delete document.documentElement.dataset.user;
  }
}

onAuthStateChanged(auth, (user) => {
  setCurrentUser(user);
  renderAuthControls(user);
  renderAccountSettings(user);
  if (user) {
    syncUserLetters(user);
  } else {
    localStorage.removeItem("future-letters.v1");
  }
});

async function registerAccount(email, password, displayName) {
  const security = window.siteSecurity;
  const credentials = security?.validateCredentials(email, password);
  if (credentials && !credentials.valid) {
    throw new Error(credentials.errors[0]);
  }
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    try {
      await updateProfile(userCredential.user, { displayName });
    } catch (e) {}
  }
  setCurrentUser(userCredential.user);
  return userCredential.user;
}

async function loginAccount(email, password) {
  const security = window.siteSecurity;
  const credentials = security?.validateCredentials(email, password);
  if (credentials && !credentials.valid) {
    throw new Error(credentials.errors[0]);
  }
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  setCurrentUser(userCredential.user);
  return userCredential.user;
}

async function logoutAccount() {
  await signOut(auth);
  setCurrentUser(null);
}

async function deleteAccount() {
  const user = auth.currentUser;
  const db = window.db;
  const dbFunctions = window.dbFunctions || {};
  const { collection, getDocs, doc, deleteDoc } = dbFunctions;
  if (!user || !db || !collection || !getDocs || !doc || !deleteDoc) {
    throw new Error("Firebaseの準備ができていません。");
  }

  const lettersSnapshot = await getDocs(collection(db, "users", user.uid, "letters"));
  const draftsSnapshot = await getDocs(collection(db, "users", user.uid, "drafts"));
  const monthSnapshot = await getDocs(collection(db, "users", user.uid, "month"));
  await Promise.all([
    ...lettersSnapshot.docs.map((entry) => deleteDoc(doc(db, "users", user.uid, "letters", entry.id))),
    ...draftsSnapshot.docs.map((entry) => deleteDoc(doc(db, "users", user.uid, "drafts", entry.id))),
    ...monthSnapshot.docs.map((entry) => deleteDoc(doc(db, "users", user.uid, "month", entry.id))),
  ]);
  await deleteUser(user);
  localStorage.removeItem("future-letters.v1");
  setCurrentUser(null);
}

async function completeRegistration(registration) {
  const msg = document.getElementById("register-message");
  if (window.siteSecurity?.isRateLimited("auth:register", 5, 60_000)) {
    msg.textContent = "登録操作が多すぎます。しばらく待ってからお試しください。";
    return;
  }
  try {
    msg.textContent = "登録中...";
    await registerAccount(registration.email, registration.password, registration.name || undefined);
    msg.textContent = "登録しました。ログインしました。";
    showView("settings");
  } catch (error) {
    msg.textContent = error.message || String(error);
  }
}

const registerForm = document.getElementById("register-form");
const registerSubmit = document.getElementById("register-submit");
const termsCheckbox = document.getElementById("register-terms");
const privacyCheckbox = document.getElementById("register-privacy");

function updateRegistrationAvailability() {
  registerSubmit.disabled = !(termsCheckbox.checked && privacyCheckbox.checked);
}

termsCheckbox?.addEventListener("change", updateRegistrationAvailability);
privacyCheckbox?.addEventListener("change", updateRegistrationAvailability);
updateRegistrationAvailability();

// Form hookups
document.addEventListener("submit", async (ev) => {
  const form = ev.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form === registerForm) {
    ev.preventDefault();
    if (!termsCheckbox.checked || !privacyCheckbox.checked) {
      document.getElementById("register-message").textContent = "利用規約とプライバシーポリシーへの同意が必要です。";
      updateRegistrationAvailability();
      return;
    }
    const name = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const msg = document.getElementById("register-message");
    try {
      await completeRegistration({ name, email, password });
    } catch (error) {
      msg.textContent = error.message || String(error);
    }
  }

  if (form.id === "login-form") {
    ev.preventDefault();
    if (window.siteSecurity?.isRateLimited("auth:login", 10, 60_000)) {
      document.getElementById("login-message").textContent = "ログイン試行が多すぎます。しばらく待ってからお試しください。";
      return;
    }
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const msg = document.getElementById("login-message");
    try {
      msg.textContent = "ログイン中...";
      await loginAccount(email, password);
      msg.textContent = "ログインしました。";
      showView("settings");
    } catch (error) {
      msg.textContent = error.message || String(error);
    }
  }
});

// Expose functions for other scripts
window.authApi = {
  registerAccount,
  loginAccount,
  logoutAccount,
};

// Helper: when click on logout button (if any)
document.addEventListener("click", (ev) => {
  const target = ev.target;
  if (!(target instanceof Element)) return;
  if (target.matches("[data-action=logout]")) {
    ev.preventDefault();
    logoutAccount().catch(() => {});
  }
});

// showView is provided by script.js; but auth.js may load before. Defer if needed.
function showView(name) {
  if (typeof window.showView === "function") {
    window.showView(name);
  } else {
    window.location.hash = name === "home" ? "" : name;
  }
}

function renderAuthControls(user) {
  const container = document.querySelector('.auth-controls');
  if (!container) return;
  if (user) {
    const name = user.displayName || user.email || 'ユーザー';
    container.innerHTML = `
      <button class="btn-link account-button nav-button" data-nav-target="settings" aria-label="アカウント設定">${escapeHtml(name)}</button>
    `;
  } else {
    container.innerHTML = `
      <button class="btn-link account-button nav-button" data-nav-target="settings" aria-label="アカウント設定">アカウント設定</button>
    `;
  }
  attachAuthControlHandlers();
}

function renderAccountSettings(user) {
  const loggedOutPanel = document.querySelector('[data-account-state="logged-out"]');
  const loggedInPanel = document.querySelector('[data-account-state="logged-in"]');
  const deleteLoggedOutPanel = document.querySelector('[data-delete-state="logged-out"]');
  const deleteLoggedInPanel = document.querySelector('[data-delete-state="logged-in"]');

  if (loggedOutPanel && loggedInPanel) {
    loggedOutPanel.hidden = Boolean(user);
    loggedInPanel.hidden = !user;
  }
  if (deleteLoggedOutPanel && deleteLoggedInPanel) {
    deleteLoggedOutPanel.hidden = Boolean(user);
    deleteLoggedInPanel.hidden = !user;
  }

  if (!user) return;

  if (!user) return;

  const displayName = user.displayName || user.email || "ユーザー";
  const displayNameElement = document.getElementById("account-display-name");
  const emailElement = document.getElementById("account-email");
  const uidElement = document.getElementById("account-uid");
  const profileNameElement = document.getElementById("profile-name");
  if (displayNameElement) displayNameElement.textContent = displayName;
  if (emailElement) emailElement.textContent = user.email || "-";
  if (uidElement) uidElement.textContent = user.uid;
  if (profileNameElement && document.activeElement !== profileNameElement) profileNameElement.value = user.displayName || "";
}

async function syncUserLetters(user) {
  try {
    const store = window.firebaseLetterStore;
    if (!store?.fetchLettersFromFirebase || window.currentUserUid !== user.uid) return;
    const letters = await store.fetchLettersFromFirebase();
    localStorage.setItem("future-letters.v1", JSON.stringify(Array.isArray(letters) ? letters : []));
  } catch (error) {
    console.error("ユーザーの日記データ読み込みに失敗しました", error);
  }
}

function getFormMessage(id) {
  return document.getElementById(id);
}

document.addEventListener("submit", async (ev) => {
  const form = ev.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.id === "profile-form") {
    ev.preventDefault();
    const name = window.siteSecurity?.validateDisplayName(document.getElementById("profile-name")?.value).value
      || document.getElementById("profile-name")?.value.trim();
    const message = getFormMessage("profile-message");
    if (!auth.currentUser || !name) return;
    try {
      await updateProfile(auth.currentUser, { displayName: name });
      setCurrentUser(auth.currentUser);
      renderAuthControls(auth.currentUser);
      renderAccountSettings(auth.currentUser);
      if (message) message.textContent = "表示名を変更しました。";
    } catch (error) {
      if (message) message.textContent = error.message || String(error);
    }
  }

  if (form.id === "password-form") {
    ev.preventDefault();
    const password = document.getElementById("new-password")?.value;
    const message = getFormMessage("password-message");
    if (!auth.currentUser || !password) return;
    try {
      await updatePassword(auth.currentUser, password);
      form.reset();
      if (message) message.textContent = "パスワードを更新しました。";
    } catch (error) {
      if (message) message.textContent = error.message || String(error);
    }
  }

  if (form.id === "delete-account-form") {
    ev.preventDefault();
    const confirmation = document.getElementById("delete-confirmation")?.value.trim();
    const message = getFormMessage("delete-account-message");
    if (confirmation !== "削除") {
      if (message) message.textContent = "確認欄に「削除」と入力してください。";
      return;
    }

    const deleteButton = form.querySelector("button[type=submit]");
    if (deleteButton) deleteButton.disabled = true;
    if (message) message.textContent = "アカウントと保存データを削除しています...";
    try {
      await deleteAccount();
      showView("home");
    } catch (error) {
      if (deleteButton) deleteButton.disabled = false;
      if (message) message.textContent = error.message || String(error);
    }
  }
});

function escapeHtml(str) {
  return String(str).replace(/[&<>\"]/g, (s) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[s]));
}

function attachAuthControlHandlers() {
  const container = document.querySelector('.auth-controls');
  if (!container) return;
  if (container.__authHandlersAttached) return;

  container.addEventListener('click', (ev) => {
    const target = ev.target instanceof Element ? ev.target.closest('[data-nav-target]') : null;
    if (!target) return;
    ev.preventDefault();
    const view = target.dataset.navTarget || 'home';
    if (typeof window.showView === 'function') {
      window.showView(view);
    } else {
      window.location.hash = view === 'home' ? '' : view;
    }
  });

  container.__authHandlersAttached = true;
}

export { auth };
