const DB_NAME = 'NotesDB';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

let db;

const noteTextEl = document.getElementById('noteText');
const coordsDisplayEl = document.getElementById('coordsDisplay');
const addBtn = document.getElementById('addBtn');
const statusEl = document.getElementById('status');
const notesContainer = document.getElementById('notesContainer');

let currentCoords = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

function addNote(text, latitude, longitude) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const note = {
      text,
      latitude,
      longitude,
      timestamp: Date.now()
    };
    const request = store.add(note);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllNotes() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteNote(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation не поддерживается'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        reject(error);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

async function refreshCoords() {
  try {
    const coords = await getCurrentPosition();
    currentCoords = coords;
    coordsDisplayEl.textContent = `Координаты: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
    statusEl.textContent = '';
  } catch (err) {
    currentCoords = null;
    coordsDisplayEl.textContent = 'Координаты: недоступны';
    statusEl.textContent = 'Не удалось получить координаты. Заметка будет сохранена без них.';
  }
}

function renderNotes(notes) {
  notesContainer.innerHTML = '';
  if (notes.length === 0) {
    notesContainer.innerHTML = '<li>Нет заметок</li>';
    return;
  }

  notes.sort((a, b) => b.timestamp - a.timestamp);

  for (const note of notes) {
    const li = document.createElement('li');

    const contentDiv = document.createElement('div');
    contentDiv.className = 'note-content';

    const textP = document.createElement('p');
    textP.className = 'note-text';
    textP.textContent = note.text;

    const coordsP = document.createElement('p');
    coordsP.className = 'note-coords';
    if (note.latitude != null && note.longitude != null) {
      coordsP.textContent = `${note.latitude.toFixed(5)}, ${note.longitude.toFixed(5)}`;
    } else {
      coordsP.textContent = 'координаты не указаны';
    }

    contentDiv.appendChild(textP);
    contentDiv.appendChild(coordsP);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Удалить';
    deleteBtn.addEventListener('click', async () => {
      await deleteNote(note.id);
      await loadAndRenderNotes();
    });

    li.appendChild(contentDiv);
    li.appendChild(deleteBtn);
    notesContainer.appendChild(li);
  }
}

async function loadAndRenderNotes() {
  const notes = await getAllNotes();
  renderNotes(notes);
}

addBtn.addEventListener('click', async () => {
  const text = noteTextEl.value.trim();
  if (!text) {
    statusEl.textContent = 'Введите текст заметки';
    return;
  }

  await addNote(
    text,
    currentCoords ? currentCoords.latitude : null,
    currentCoords ? currentCoords.longitude : null
  );
  noteTextEl.value = '';
  statusEl.textContent = 'Заметка добавлена';
  await loadAndRenderNotes();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registered', reg))
      .catch(err => console.log('SW registration failed', err));
  });
}

(async () => {
  await openDB();
  await refreshCoords();
  await loadAndRenderNotes();
})();