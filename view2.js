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

function removeInboxFab() {
  const existing = document.getElementById("inbox-reply-fab");
  if (existing) existing.remove();
}
