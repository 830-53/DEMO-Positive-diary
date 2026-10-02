function ensureHusenDialog() {
  let dialog = document.getElementById("husen-dialog");
  if (dialog) {
    return dialog;
  }

  dialog = document.createElement("dialog");
  dialog.id = "husen-dialog";
  dialog.innerHTML = `
    <form id="husen-form" class="husen-paper">
      <h3 class="husen-title">付箋メモ</h3>
      <textarea id="husen-body" class="husen-body" rows="8" placeholder="ここに一言メモを残す"></textarea>
      <p id="husen-output" class="husen-output" hidden></p>
      <p id="husen-message" class="husen-message" role="status" aria-live="polite"></p>
      <div class="husen-actions">
        <button id="husen-save" class="husen-button husen-save" type="submit">保存</button>
        <button id="husen-close" class="husen-button husen-close" type="button">閉じる</button>
      </div>
    </form>
  `;

  document.body.appendChild(dialog);

  const form = dialog.querySelector("#husen-form");
  const textarea = dialog.querySelector("#husen-body");
  const output = dialog.querySelector("#husen-output");
  const message = dialog.querySelector("#husen-message");
  const saveButton = dialog.querySelector("#husen-save");
  const closeButton = dialog.querySelector("#husen-close");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";

    const letterId = dialog.currentLetterId;
    const body = String(textarea.value || "").trim();
    if (!body) {
      message.textContent = "メモを入力してください。";
      textarea.focus();
      return;
    }

    saveButton.disabled = true;
    const saved = await saveHusenToFirebase(letterId, body);
    saveButton.disabled = false;

    if (!saved) {
      message.textContent = "保存できませんでした。もう一度お試しください。";
      return;
    }

    dialog.close();
    document.getElementById("reply-dialog")?.classList.remove("husen-dimmed");
  });

  closeButton.addEventListener("click", () => {
    dialog.close();
    document.getElementById("reply-dialog")?.classList.remove("husen-dimmed");
  });

  dialog.addEventListener("close", () => {
    textarea.value = "";
    textarea.hidden = false;
    output.hidden = true;
    output.textContent = "";
    message.textContent = "";
    message.hidden = false;
    saveButton.hidden = false;
    document.getElementById("reply-dialog")?.classList.remove("husen-dimmed");
  });

  return dialog;
}

async function saveHusenToFirebase(letterId, body) {
  const letters = loadletters();
  const index = letters.findIndex((letter) => letter.id === letterId);
  if (index === -1) {
    return false;
  }

  if (Array.isArray(letters[index].replies) && letters[index].replies.length > 0) {
    return false;
  }

  letters[index].replies = [{
    id: crypto.randomUUID(),
    body,
    createdAt: new Date().toISOString(),
  }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));

  try {
    const db = window.db;
    const dbFunctions = window.dbFunctions || {};
    const { collection, getDocs, doc, setDoc, deleteDoc } = dbFunctions;
    const currentUid = window.currentUserUid || window.firebaseAuth?.currentUser?.uid;

    if (!db || !collection || !getDocs || !doc || !setDoc || !deleteDoc) {
      throw new Error("Firebaseの準備ができていません。");
    }

    const collectionPath = currentUid
      ? ["users", currentUid, "letters"]
      : ["letters"];
    await setDoc(doc(db, ...collectionPath, letter.id), letter);

    try {
      const lettersCollection = collection(db, ...collectionPath);
      const snapshot = await getDocs(lettersCollection);
      const duplicateDocuments = snapshot.docs.filter((entry) => {
        const data = entry.data() || {};
        const sameLetterId = data.id === letter.id;
        const sameLetterContent = data.title === letter.title
          && data.body === letter.body
          && data.createdAt === letter.createdAt;
        return (sameLetterId || sameLetterContent) && entry.id !== letter.id;
      });

      await Promise.all(duplicateDocuments.map((entry) => deleteDoc(entry.ref)));
    } catch (cleanupError) {
      console.warn("付箋付き日記は保存されましたが、重複データの削除に失敗しました:", cleanupError);
    }
  }
  catch (error) {
    console.error("付箋メモのFirebase保存に失敗しました:", error);
    return false;
  }

  if (appState.activeView === "inbox") {
    renderInboxView();
  }
  return true;
}

function openHusenDialog(letterId) {
  const letter = loadletters().find((item) => item.id === letterId);
  if (!letter) {
    return;
  }

  const replyDialog = document.getElementById("reply-dialog");
  const dialog = ensureHusenDialog();
  const textarea = dialog.querySelector("#husen-body");
  const output = dialog.querySelector("#husen-output");
  const message = dialog.querySelector("#husen-message");
  const saveButton = dialog.querySelector("#husen-save");
  const savedMemo = Array.isArray(letter.replies) && letter.replies[0]
    ? String(letter.replies[0].body || "")
    : "";
  const hasSavedMemo = Boolean(savedMemo);

  dialog.currentLetterId = letterId;
  textarea.value = hasSavedMemo ? savedMemo : "";
  textarea.hidden = hasSavedMemo;
  output.textContent = savedMemo;
  output.hidden = !hasSavedMemo;
  message.hidden = hasSavedMemo;
  saveButton.hidden = hasSavedMemo;
  replyDialog?.classList.add("husen-dimmed");
  dialog.showModal();
  (hasSavedMemo ? output : textarea).focus();
}
