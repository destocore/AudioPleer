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
const savedRepeat = localStorage.getItem('repeatMode')

if (savedVolume !== null) {
    volumeBar.value = savedVolume;              // Визуально двигаем ползунок на место
    audio.volume = parseFloat(savedVolume) / 100; // Устанавливаем громкость звука (от 0.0 до 1.0)
} else {
    audio.volume = volumeBar.value / 100;       // Если первый заход — берем дефолт из HTML (100)
}

if (savedRepeat !== null){
    repeatMode = savedRepeat;
    list = null
    if (repeatMode === 'list') {
        list = "→ Без повтора";
    } else if (repeatMode === 'list-loop') {
        list = "⟳ Весь список";
    } else {
        list = "⟲ Один трек";
    }
    repeatBtn.innerText = list;
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
    else { audio.pause(); playBtn.innerText = "▶"; }
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
        repeatBtn.innerText = "⟳ Весь список";
    } else if (repeatMode === 'list-loop') {
        repeatMode = 'one-loop';
        repeatBtn.innerText = "⟲ Один трек";
    } else {
        repeatMode = 'list';
        repeatBtn.innerText = "→ Без повтора";
    }
    
    // ВОТ ЭТА СТРОКА ОБЯЗАТЕЛЬНА, чтобы данные записывались в браузер при клике:
    localStorage.setItem('repeatMode', repeatMode);
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
            playBtn.innerText = "▶"; 
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

    // 🔒 ГИБКИЙ КОНФИГ РАЗРЕШЕНИЙ (Считываем один раз при загрузке страницы)
    // Ищем признаки того, что Django разрешил те или иные действия
    const allowedActions = {
        delete: document.querySelector(".track-list .delete-btn[onclick*='confirmDelete']") !== null,
        rename: document.querySelector(".track-list .delete-btn[onclick*='rename']") !== null,
        replace: document.querySelector(".track-list .delete-btn[onclick*='replace']") !== null
        // 💡 Сюда можно легко дописать новое разрешение в будущем, например:
        // download: document.querySelector(".track-list .download-btn") !== null
    };

    searchInput.addEventListener("input", (event) => {
        const query = event.target.value.toLowerCase().trim();
        const playlistName = (typeof currentPlaylist !== 'undefined') ? currentPlaylist : '';

        // Фильтруем массив треков
        const filteredTracks = tracksData.filter(track => 
            track.name.toLowerCase().includes(query)
        );

        // Очищаем контейнер
        trackListContainer.innerHTML = "";

        if (filteredTracks.length === 0) {
            trackListContainer.innerHTML = `
                <div class="track-empty-state">
                    <p>Музыка не найдена</p>
                </div>`;
            return;
        }

        filteredTracks.forEach((track) => {
            const originalIndex = tracksData.findIndex(t => t.url === track.url);

            // Создаем обертку трека
            const trackDiv = document.createElement("div");
            trackDiv.className = "track-item";
            trackDiv.setAttribute("onclick", `playTrack(${originalIndex})`);
            
            // Название трека
            const trackText = document.createElement("p");
            trackText.textContent = track.name;
            trackDiv.appendChild(trackText);

            // 🛠️ ДИНАМИЧЕСКИЙ БЛОК КНОПОК (Если разрешено хоть что-то)
            if (allowedActions.delete || allowedActions.rename) {
                // Создаем правильный контейнер для кнопок, чтобы работали стили плагина
                const buttonsContainer = document.createElement("div");
                buttonsContainer.className = "buttons-container"; 
                buttonsContainer.id = "buttons"; // Совместимость со старой версткой

                // 1. Кнопка удаления ❌
                if (allowedActions.delete) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = '❌';
                    deleteBtn.className = "delete-btn";
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const safeTrackName = track.name.replace(/'/g, "\\'");
                        confirmDelete(deleteBtn, safeTrackName, playlistName); 
                    });
                    buttonsContainer.appendChild(deleteBtn);
                }

                // 2. Кнопка переименования ✏️
                if (allowedActions.rename) {
                    const renameBtn = document.createElement('button');
                    renameBtn.textContent = '✏️';
                    renameBtn.className = "delete-btn"; // Твой класс для стилей кнопок
                    renameBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // Вызываем нашу функцию плагина, передавая саму кнопку и тип
                        rename(renameBtn, 'mus'); 
                    });
                    buttonsContainer.appendChild(renameBtn);
                }

                if (allowedActions.replace) {
                    const replaceBtn = document.createElement('button');
                    replaceBtn.textContent = '⇆';
                    replaceBtn.className = "delete-btn"; // Твой класс для стилей кнопок
                    replaceBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // Вызываем нашу функцию плагина, передавая саму кнопку и тип
                        replace(replaceBtn);
                    });
                    buttonsContainer.appendChild(replaceBtn);
                }

                // 💡 Сюда ты сможешь вписать "if (allowedActions.download) { ... }" в V2 или V3

                trackDiv.appendChild(buttonsContainer);
            }

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

function rename(buttonE, type) {
    if (type === "playlist") {
        const divv = buttonE.closest('.play-item'); 
        if (!divv) return;

        const textt = divv.querySelector('p');
        if (!textt) return;

        const oldtextt = textt.textContent;
        // Очищаем старое имя от смайликов для отправки в Django
        const oldCleanName = oldtextt.replace(/[📁🎵🏠]/g, '').trim(); 
        
        const Buttns = divv.querySelector('#buttons');
        const originalDisplay = Buttns ? (Buttns.style.display || 'flex') : 'flex'; 
        if (Buttns) Buttns.style.display = 'none';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input'; 
        input.value = oldCleanName; 

        input.addEventListener('click', (e) => e.stopPropagation());

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation(); 
                input.blur(); 
            }
        });

        input.addEventListener('blur', (event) => {
            event.stopPropagation();

            if (Buttns) Buttns.style.display = originalDisplay;

            const finalValue = input.value.trim();
            const newTextContent = `🎵 ${finalValue}`;

            if (newTextContent === oldtextt) {
                input.replaceWith(textt);
                return;
            }

            const newP = document.createElement('p');
            newP.textContent = newTextContent;
            input.replaceWith(newP);

            // ИСПРАВЛЕНО 1: Разделение через '&' вместо '?'
            // ИСПРАВЛЕНО 3: Передаем чистые имена без смайликов
            const URLrename = `/rename-pl/?playlist=${encodeURIComponent(oldCleanName)}&new_name=${encodeURIComponent(finalValue)}`;
            
            // ИСПРАВЛЕНО 2: Используем метод POST вместо выдуманного RENAME
            fetch(URLrename, {
                method: 'RENAME', 
                headers: {
                    'X-CSRFToken': getCookie('csrftoken') 
                }
            })
            .then(response => {
                if (response.ok){
                    window.location.href = `/playlist/${finalValue}`;
                } else {
                    alert('Произошла ошибка на сервере!');
                    // Если сервер ответил ошибкой, возвращаем старый текст
                    newP.replaceWith(textt);
                }
            })
            .catch(error => {
                console.error('Ошибка сети:', error);
                alert('Не удалось связаться с сервером');
                newP.replaceWith(textt);
            });
        });

        textt.replaceWith(input);
        input.focus();
    }
    if (type === "mus") {
        // 1. Находим строку трека
        const divv = buttonE.closest('.track-item'); 
        if (!divv) return;

        const textt = divv.querySelector('p');
        if (!textt) return;

        const oldtextt = textt.textContent.trim();
        const oldCleanName = oldtextt.replace('.mp3', '').trim(); 
        
        // Прячем кнопки на время редактирования
        const Buttns = divv.querySelector('#buttons') || divv.querySelector('.buttons-container');
        const originalDisplay = Buttns ? (Buttns.style.display || 'flex') : 'flex'; 
        if (Buttns) Buttns.style.display = 'none';

        // Создаем инпут
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input'; 
        input.value = oldCleanName; 

        input.addEventListener('click', (e) => e.stopPropagation());

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation(); 
                input.blur(); 
            }
        });

        // Обработка потери фокуса (сохранение)
        input.addEventListener('blur', (event) => {
            event.stopPropagation();

            if (Buttns) Buttns.style.display = originalDisplay;

            const finalValue = input.value.trim();
            const newTextContent = finalValue.endsWith('.mp3') ? finalValue : `${finalValue}.mp3`;

            // Если имя не изменилось — просто возвращаем текст назад
            if (newTextContent === oldtextt) {
                input.replaceWith(textt);
                return;
            }

            const newP = document.createElement('p');
            newP.textContent = newTextContent; 
            input.replaceWith(newP);

            // Вытаскиваем имя плейлиста из URL
            const currentPlaylist = window.location.pathname.split('/').filter(Boolean).pop();
            let URLrename;

            if (currentPlaylist && window.location.pathname.includes('/playlist/')) {
                URLrename = `/rename-mus/?playlist=${encodeURIComponent(currentPlaylist)}&mus=${encodeURIComponent(oldCleanName)}&new_name=${encodeURIComponent(finalValue)}`;
            } else {
                URLrename = `/rename-mus/?mus=${encodeURIComponent(oldCleanName)}&new_name=${encodeURIComponent(finalValue)}`;
            }
            
            // ==========================================
            // ВОТ ЭТОТ КУСОК КОДА ВСТАВЛЯЕТСЯ СЮДА:
            // ==========================================
            fetch(URLrename, {
                method: 'RENAME', 
                headers: {
                    'X-CSRFToken': getCookie('csrftoken') 
                }
            })
            .then(response => {
                if (response.ok) {
                    // УСПЕХ: Обновляем данные в массиве плеера без перезагрузки страницы
                    const onclickAttr = divv.getAttribute('onclick');
                    const match = onclickAttr ? onclickAttr.match(/playTrack\((\d+)\)/) : null;
                    
                    if (match && match[1]) {
                        const trackIndex = parseInt(match[1], 10);

                        if (typeof tracksData !== 'undefined' && tracksData[trackIndex]) {
                            const oldUrl = tracksData[trackIndex].url;
                            
                            // Меняем старое закодированное имя на новое в ссылке
                            const newUrl = oldUrl.replace(encodeURIComponent(oldCleanName), encodeURIComponent(finalValue));

                            // Записываем новые данные в глобальный массив
                            tracksData[trackIndex].name = newTextContent;
                            tracksData[trackIndex].url = newUrl;

                            console.log(`Данные трека #${trackIndex} в плеере успешно обновлены!`);
                            
                            // Если этот трек играет прямо сейчас, обновляем название в плеере на ходу
                            if (typeof currentIdx !== 'undefined' && currentIdx === trackIndex) {
                                if (typeof titleDisplay !== 'undefined') {
                                    titleDisplay.innerText = newTextContent;
                                }
                            }
                        }
                    }
                } else {
                    alert('Произошла ошибка на сервере!');
                    newP.replaceWith(textt);
                }
            })
            .catch(error => {
                console.error('Ошибка сети:', error);
                alert('Не удалось связаться с сервером');
                newP.replaceWith(textt);
            });
            // ==========================================
        });

        // Активируем инпут
        textt.replaceWith(input);
        input.focus();
    }
}

function replace(butn) {
    const divv = butn.closest('.track-item');
    if (!divv) return;
    
    const obname = divv.querySelector('p');
    if (!obname) return;
    const name = obname.textContent.trim();

    const playlistElements = document.querySelectorAll('.sidebar .play-item p');
    
    const select = document.createElement('select');
    select.className = 'replace-select';

    const rootOption = document.createElement('option');
    rootOption.value = ""; 
    rootOption.textContent = "---> Выберите плейлист здесь <---";
    select.appendChild(rootOption);

    const rootOption1 = document.createElement('option');
    rootOption1.value = ""; 
    rootOption1.textContent = "🏠 Главная (Корень)";
    select.appendChild(rootOption1);
    
    playlistElements.forEach(p => {
        const text = p.textContent.trim();
        if (text.includes('🏠')) return; 

        const cleanPlaylistName = text.replace(/[📁🎵🏠]/g, '').trim();

        const option = document.createElement('option');
        option.value = cleanPlaylistName;
        option.textContent = text;
        select.appendChild(option);
    });

    select.addEventListener('click', (e) => e.stopPropagation());

    // ФЛАГ-ЗАЩИТА: предотвращает конфликт между blur и fetch
    let isProcessing = false;

    select.addEventListener('change', () => {
        isProcessing = true; // Блокируем стандартный blur, так как пошел запрос
        
        const finalValue = select.value; 
        const currentPlaylist = window.location.pathname.split('/').filter(Boolean).pop();
        let URLrename;

        const cleanTrackName = name.replace('.mp3', '').trim();

        // Если мы переносим в тот же плейлист, где песня уже лежит — даже не шлем запрос
        if (currentPlaylist === finalValue || (!currentPlaylist && finalValue === "")) {
            isProcessing = false;
            select.replaceWith(obname); // Просто возвращаем текст обратно
            return;
        }

        if (currentPlaylist && window.location.pathname.includes('/playlist/')) {
            URLrename = `/replace-mus/?playlist=${encodeURIComponent(currentPlaylist)}&mus=${encodeURIComponent(cleanTrackName)}&new_pl=${encodeURIComponent(finalValue)}`;
        } else {
            URLrename = `/replace-mus/?mus=${encodeURIComponent(cleanTrackName)}&new_pl=${encodeURIComponent(finalValue)}`;
        }
        
        audio.pause();
        
        fetch(URLrename, {
            method: 'REPLACE', 
            headers: {
                'X-CSRFToken': getCookie('csrftoken') 
            }
        }) 
        .then(response => {
            if (response.ok) {
                // ========================================================
                // ⚙️ НАЧАЛО БЛОКА ОЧИСТКИ ПАМЯТИ ПЛЕЕРА
                // ========================================================
                
                // 1. Вытаскиваем индекс удаляемого трека из его onclick атрибута
                const onclickAttr = divv.getAttribute('onclick');
                const match = onclickAttr ? onclickAttr.match(/playTrack\((\d+)\)/) : null;
                
                if (match) {
                    const trackIndex = parseInt(match[1], 10);
                    
                    // 2. Полностью вырезаем песню из глобального массива
                    if (typeof tracksData !== 'undefined' && tracksData[trackIndex]) {
                        tracksData.splice(trackIndex, 1);
                        
                        // 3. Сдвигаем playTrack(idx) на единицу назад у всех треков ниже по списку в HTML
                        const allTrackItems = document.querySelectorAll('.track-list .track-item');
                        allTrackItems.forEach(item => {
                            const itemOnclick = item.getAttribute('onclick');
                            const itemMatch = itemOnclick ? itemOnclick.match(/playTrack\((\d+)\)/) : null;
                            if (itemMatch) {
                                const idx = parseInt(itemMatch[1], 10);
                                if (idx > trackIndex) {
                                    item.setAttribute('onclick', `playTrack(${idx - 1})`);
                                }
                            }
                        });

                        // 4. Корректируем индекс текущего трека (currentIdx), чтобы prev/next не ломались
                        if (typeof currentIdx !== 'undefined') {
                            if (currentIdx > trackIndex) {
                                // Если убрали трек, бывший ДО текущего — сдвигаем указатель назад
                                currentIdx--;
                            } else if (currentIdx === trackIndex) {
                                // Если убрали песню, которая играет прямо сейчас — сдвигаем назад,
                                // чтобы функция nextTrack() включила правильный следующий трек
                                currentIdx--; 
                            }
                        }
                    }
                }
                
                // ========================================================
                // ⚙️ КОНЕЦ БЛОКА ОЧИСТКИ ПАМЯТИ ПЛЕЕРА
                // ========================================================

                // Удаляем визуальную строчку с экрана
                divv.remove(); 
                
                // Включаем следующий по порядку трек
                if (typeof nextTrack === 'function') {
                    nextTrack();
                }
            } else {
                alert('Произошла ошибка на сервере при перемещении!');
                // Безопасный возврат: проверяем, висит ли еще селект в DOM
                if (select.parentNode) select.replaceWith(obname);
                audio.play(); // Запускаем плеер обратно, раз перемещение сорвалось
            }
        }) 
        .catch(error => {
            console.error('Ошибка сети:', error);
            alert('Не удалось связаться с сервером');
            if (select.parentNode) select.replaceWith(obname);
            audio.play();
        })
        .finally(() => {
            isProcessing = false;
        });
    });

    // Модифицированный blur: срабатывает только если пользователь передумал и кликнул мимо
    select.addEventListener('blur', () => {
        setTimeout(() => {
            // Если процесс отправки не идет и элемент еще на странице — возвращаем текст
            if (!isProcessing && select.parentNode) {
                select.replaceWith(obname);
            }
        }, 100); // Небольшая задержка, чтобы дать приоритет событию 'change'
    });

    obname.replaceWith(select);
    select.focus();
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