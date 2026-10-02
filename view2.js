function ensureReplyDialog() {
  let dlg = document.getElementById("reply-dialog");
  if (dlg) return dlg;

  dlg = document.createElement("dialog");
  dlg.id = "reply-dialog";

  dlg.innerHTML = `
    <div class="reply-form">
      <div class="reply-dialog-paper">
        <header class="reply-dialog-header">
        </header>

        <section id="reply-original" class="reply-original-section"></section>
        <div class="reply-dialog-actions">
          <button id="husen-open" type="button" class="husen-open-button">付箋にメモ</button>
          <button id="reply-cancel" type="button" class="btn-secondary">閉じる</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dlg);

  const original = dlg.querySelector("#reply-original");
  const husenOpen = dlg.querySelector("#husen-open");
  const cancel = dlg.querySelector("#reply-cancel");

  let currentTargetId = null;

  function populateSelect(preselectId) {
    const letters = loadletters()
      .filter((l) => new Date(l.deliveryAt).getTime() <= Date.now())
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    currentTargetId = preselectId || (letters.length > 0 ? letters[0].id : null);
    updateOriginal();
  }

  function updateOriginal() {
    const letter = loadletters().find((x) => x.id === currentTargetId);
    renderReplyOriginal(original, letter);
  }

  cancel.addEventListener("click", () => dlg.close());
  husenOpen.addEventListener("click", () => openHusenDialog(currentTargetId));

  dlg.populateSelect = populateSelect;
  dlg.setSelected = (id) => {
    populateSelect(id);
  };

  return dlg;
}

function openReplyDialogForletter(letter) {
  const id = letter && typeof letter === "object" ? letter.id : String(letter || "");
  const letters = loadletters();
  const target = letters.find((l) => l.id === id);
  if (!target) {
    alert("対象の手紙が見つかりませんでした。");
    return;
  }

  const dlg = ensureReplyDialog();
  dlg.populateSelect(id);
  dlg.showModal();
}

function openReplyDialog() {
  const dlg = ensureReplyDialog();
  dlg.populateSelect();
  dlg.showModal();
}

function saveReplyToletter(letterId, replyBody) {
  const letters = loadletters();
  const idx = letters.findIndex((l) => l.id === letterId);
  if (idx === -1) {
    alert("返信先の手紙が見つかりませんでした。");
    return false;
  }
  if (Array.isArray(letters[idx].replies) && letters[idx].replies.length > 0) {
    alert("この手紙には既に返信が行われています。返信は1回までです。");
    return false;
  }

  const reply = {
    id: crypto.randomUUID(),
    body: replyBody,
    createdAt: new Date().toISOString(),
  };

  letters[idx].replies = [reply];
  saveletters(letters);

  if (appState.activeView === "inbox") {
    renderInboxView();
  }

  return true;
}

function ensureInboxFab() {
  const existing = document.getElementById("inbox-reply-fab");
  if (existing) return existing;

  const btn = document.createElement("button");
  btn.id = "inbox-reply-fab";
  btn.type = "button";
  btn.title = "返答する";
  btn.innerHTML = "✉️";
  btn.style.position = "fixed";
  btn.style.right = "16px";
  btn.style.bottom = "16px";
  btn.style.width = "48px";
  btn.style.height = "48px";
  btn.style.borderRadius = "24px";
  btn.style.border = "none";
  btn.style.background = "#ff8fa3";
  btn.style.color = "#fff";
  btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
  btn.style.cursor = "pointer";
  btn.style.zIndex = 9999;

  btn.addEventListener("click", () => {
    openReplyDialog();
  });

  document.body.appendChild(btn);
  return btn;
}

function removeInboxFab() {
  const existing = document.getElementById("inbox-reply-fab");
  if (existing) existing.remove();
}

function ensureDialogFab(dialog, letterId) {
  if (!dialog) return null;
  removeDialogFab();

  const btn = document.createElement("button");
  btn.id = "dialog-reply-fab";
  btn.type = "button";
  btn.title = "返信する";
  btn.innerHTML = "✉️";
  btn.style.position = "absolute";
  btn.style.right = "12px";
  btn.style.bottom = "12px";
  btn.style.width = "44px";
  btn.style.height = "44px";
  btn.style.borderRadius = "22px";
  btn.style.border = "none";
  btn.style.background = "#ff8fa3";
  btn.style.color = "#fff";
  btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
  btn.style.cursor = "pointer";
  btn.style.zIndex = 2147483647;

  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    openReplyDialogForletter({ id: letterId });
  });

  if (getComputedStyle(dialog).position === "static") {
    dialog.style.position = "relative";
  }

  dialog.appendChild(btn);
  return btn;
}

function removeDialogFab() {
  const existing = document.getElementById("dialog-reply-fab");
  if (existing) existing.remove();
}
