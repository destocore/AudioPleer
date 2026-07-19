let currentIdx = 0;
let repeatMode = 'list'; // варианты: 'list', 'list-loop', 'one-loop'
let isSeeking = false;

const audio = document.getElementById('main-audio');
const playBtn = document.getElementById('play-btn');
const repeatBtn = document.getElementById('repeat-btn');
const progressBar = document.getElementById('progress-bar');
const volumeBar = document.getElementById('volume-bar');
const titleDisplay = document.getElementById('current-title');

// ==========================================
// НАСТРОЙКА ГРОМКОСТИ С ПОДДЕРЖКОЙ СЕССИИ
// ==========================================

// 1. При загрузке страницы проверяем, есть ли сохраненная громкость
const savedVolume = localStorage.getItem('player-volume');

if (savedVolume !== null) {
    volumeBar.value = savedVolume;              // Визуально двигаем ползунок на место
    audio.volume = parseFloat(savedVolume) / 100; // Устанавливаем громкость звука (от 0.0 до 1.0)
} else {
    audio.volume = volumeBar.value / 100;       // Если первый заход — берем дефолт из HTML (100)
}

// 2. Слушаем изменения ползунка и сохраняем в память
volumeBar.oninput = () => {
    audio.volume = volumeBar.value / 100;
    localStorage.setItem('player-volume', volumeBar.value); // Запоминаем выбор пользователя
};

// ==========================================
// ЛОГИКА ПЛЕЕРА
// ==========================================

// ВКЛЮЧЕНИЕ ТРЕКА
function playTrack(idx) {
    if (idx < 0 || idx >= tracksData.length) return;
    currentIdx = idx;
    audio.src = tracksData[currentIdx].url;
    titleDisplay.innerText = tracksData[currentIdx].name;
    audio.play();
    playBtn.innerText = "⏸";
}

// ПЛЕЙ / ПАУЗА
function togglePlay() {
    if (!audio.src) { playTrack(0); return; }
    if (audio.paused) { audio.play(); playBtn.innerText = "⏸"; } 
    else { audio.pause(); playBtn.innerText = "▶️"; }
}

// ПЕРЕМОТКА ТРЕКА (Чистый код без дубликатов)
progressBar.onmousedown = () => { isSeeking = true; };
progressBar.onmouseup = () => { isSeeking = false; };

progressBar.onchange = () => {
    if (audio.duration) {
        const time = (progressBar.value / 100) * audio.duration;
        audio.currentTime = time;
    }
    isSeeking = false;
};

progressBar.oninput = () => {
    if (audio.duration) {
        const time = (progressBar.value / 100) * audio.duration;
        audio.currentTime = time;
    }
};

// Автоматическое движение ползунка при воспроизведении
audio.ontimeupdate = () => {
    if (audio.duration && !isSeeking) {
        progressBar.value = (audio.currentTime / audio.duration) * 100;
    }
};

// СИСТЕМА ПОВТОРОВ
function changeRepeatMode() {
    if (repeatMode === 'list') {
        repeatMode = 'list-loop';
        repeatBtn.innerText = "🔁 Весь список";
    } else if (repeatMode === 'list-loop') {
        repeatMode = 'one-loop';
        repeatBtn.innerText = "🔂 Один трек";
    } else {
        repeatMode = 'list';
        repeatBtn.innerText = "➡️ Без повтора";
    }
}

// ЛОГИКА ОКОНЧАНИЯ ТРЕКА
audio.onended = () => {
    if (repeatMode === 'one-loop') {
        audio.play(); 
    } else if (repeatMode === 'list-loop') {
        nextTrack(); 
    } else if (repeatMode === 'list') {
        if (currentIdx < tracksData.length - 1) {
            nextTrack();
        } else {
            playBtn.innerText = "▶️"; 
        }
    }
};

// НАВИГАЦИЯ
function nextTrack() {
    if (tracksData.length === 0) return;
    currentIdx = (currentIdx + 1) % tracksData.length;
    playTrack(currentIdx);
}

function prevTrack() {
    if (tracksData.length === 0) return;
    currentIdx = (currentIdx - 1 + tracksData.length) % tracksData.length;
    playTrack(currentIdx);
}

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("search-input");
    const trackListContainer = document.querySelector(".track-list");

    if (!searchInput || !trackListContainer) return;

    searchInput.addEventListener("input", (event) => {
        const query = event.target.value.toLowerCase().trim();
        
        const filteredTracks = tracksData.filter(track => 
            track.name.toLowerCase().includes(query)
        );

        trackListContainer.innerHTML = "";

        if (filteredTracks.length === 0) {
            trackListContainer.innerHTML = `
                <div class="track-empty-state">
                    <p>Музыка не найдена</p>
                </div>`;
            return;
        }

        // БЕЗОПАСНО ПОЛУЧАЕМ ИМЯ ПЛЕЙЛИСТА:
        // Если у вас где-то выше объявлена переменная с плейлистом (например, в HTML), 
        // проверяем её существование. Если её нет, берем пустую строку, чтобы Django-view не ругался.
        const playlistName = (typeof currentPlaylist !== 'undefined') ? currentPlaylist : '';

        filteredTracks.forEach((track) => {
            const originalIndex = tracksData.findIndex(t => t.url === track.url);

            const trackDiv = document.createElement("div");
            trackDiv.className = "track-item";
            trackDiv.setAttribute("onclick", `playTrack(${originalIndex})`);
            
            const trackText = document.createElement("p");
            trackText.textContent = track.name;

            const trackDB = document.createElement('button');
            trackDB.textContent = '❌';
            trackDB.className = "delete-btn";
            
            trackDB.addEventListener('click', (event) => {
                event.stopPropagation();
                const safeTrackName = track.name.replace(/'/g, "\\'");
                
                // Исправлено: передаем локально вычисленное имя плейлиста 👇
                confirmDelete(trackDB, safeTrackName, playlistName); 
            });

            trackDiv.appendChild(trackText);
            trackDiv.appendChild(trackDB);
            trackListContainer.appendChild(trackDiv);
        });
    });
});

function confirmDelete(buttonElement, trackName, playlistName) {
    const isConfirmed = confirm(`Вы точно хотите удалить песню "${trackName}"?`);
    
    if (isConfirmed) {
        let deleteUrl = `/delete-track/?track=${encodeURIComponent(trackName)}`;
        if (playlistName) {
            deleteUrl += `&playlist=${encodeURIComponent(playlistName)}`;
        }
        
        fetch(deleteUrl, {
            method: 'DELETE', 
            headers: {
                'X-CSRFToken': getCookie('csrftoken') 
            }
        })
        .then(response => {
            if (response.ok) {
                const trackItem = buttonElement.closest('.track-item');
                trackItem.remove();
                
                const trackList = document.querySelector('.track-list');
                if (trackList.children.length === 0) {
                    trackList.innerHTML = '<div class="track-empty-state"><p>Музыка не найдена</p></div>';
                }
            } else {
                alert('Ошибка при удалении файла на сервере.');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            alert('Не удалось связаться с сервером.');
        });
    }
}

function confirmDeletePlaylist(buttonE, playlistN) {
    const isConfirmed = confirm(`Вы точно хотите удалить плейлист "${playlistN}"?`);

    if (isConfirmed) {
        // ДОПОЛНИТЕЛЬНО (для Windows): Сбрасываем плеер, чтобы снять блокировку с файлов
        const audioPlayer = document.querySelector('audio'); // или ваша переменная плеера
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.src = ''; 
        }

        let deleteUrl = `/delete-pl/?playlist=${encodeURIComponent(playlistN)}`;
        
        fetch(deleteUrl, {
            method: 'DELETE', 
            headers: {
                'X-CSRFToken': getCookie('csrftoken') 
            }
        })
        .then(response => {
            if (response.ok) {
                window.location.href = '/'; // Улетаем на главную
            } else {
                alert('Ошибка при удалении плейлиста на сервере.');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            alert('Не удалось связаться с сервером.');
        });
    }
}


// Вспомогательная функция для получения CSRF-токена Django
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
