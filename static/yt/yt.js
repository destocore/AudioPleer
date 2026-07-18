document.addEventListener('DOMContentLoaded', function () {
    const selectElement = document.getElementById('playlist-select');
    const container = document.getElementById('dynamic-input-container');

    selectElement.addEventListener('change', function () {
        // Проверяем, выбрана ли именно опция создания плейлиста
        if (this.value === '₡₹€ate') {
            // Если инпут еще не создан, создаем его
            if (!document.getElementById('new-playlist-input')) {
                const newInput = document.createElement('input');
                newInput.type = 'text';
                newInput.name = 'plname'; // Имя для обработки в Django (request.POST)
                newInput.placeholder = 'Введите название нового плейлиста';
                newInput.className = 'dow';
                newInput.id = 'new-playlist-input';
                newInput.style.marginTop = '5px';
                newInput.required = true; // Делаем поле обязательным

                container.appendChild(newInput);
            }
        } else {
            // Если выбрана другая опция, удаляем инпут
            container.innerHTML = '';
        }
    });
});
