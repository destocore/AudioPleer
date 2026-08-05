from django.shortcuts import render, redirect
from django.conf import settings
from django.http import Http404, FileResponse, JsonResponse
import os
import yt_dlp
import requests
import shutil
from django.utils._os import safe_join
from urllib.parse import unquote
from pathlib import Path
from pytubefix import YouTube

shup = False

def needUpd():
    try:
        response = requests.get("https://raw.githubusercontent.com/destocore/AudioPleer/refs/heads/master/version.txt")
    except:
        return False
    if response.status_code == 200:
        try:
            response = response.text.split("=")[1].strip(' "\n')
            return response != settings.VERSION
        except:
            return False
    return False

music_dir = safe_join(settings.MEDIA_ROOT, 'music')

def main(req):
    global shup
    if settings.AUTO_UPGRADE_CHECK and not shup:
        if needUpd():
            shup = True
            return render(req, "updt.html")
        else:
            shup = False
    # Список имен файлов (только файлы, исключая папки)
    tracks = []
    if os.path.exists(music_dir):
        tracks = [f for f in os.listdir(music_dir) if os.path.isfile(safe_join(music_dir, f))]

    playlist = []
    if os.path.exists(music_dir):
        playlist = [f for f in os.listdir(music_dir) if os.path.isdir(safe_join(music_dir, f))]
    
    return render(req, 'index.html', {
            'tracks': tracks,
            'playlist': playlist,
            'exst': settings.EXPORT["status"],
            'aldelp': settings.ALLOW_DEL["playlist"],
            'aldelm': settings.ALLOW_DEL["mus"],
            'alrep': settings.ALLOW_REN["playlist"],
            'alrem': settings.ALLOW_REN["mus"],
            'alrepm': settings.ALLOW_REPM,
        }
    )

def openPlaylist(req, playlist: str):
    tracks = []
    playlists_list = []
    if os.path.exists(music_dir):
        playlists_list = [f for f in os.listdir(music_dir) if os.path.isdir(safe_join(music_dir, f))]

    if os.path.exists(safe_join(music_dir, playlist)):
        tracks = [f for f in os.listdir(safe_join(music_dir, playlist)) if os.path.isfile(safe_join(music_dir, playlist, f))]
        
        return render(req, 'index.html', {
            'tracks': tracks, 
            'playlist': playlists_list, 
            'current_playlist': playlist,
            'exst': settings.EXPORT["status"],
            'aldelp': settings.ALLOW_DEL["playlist"],
            'aldelm': settings.ALLOW_DEL["mus"],
            'alrep': settings.ALLOW_REN["playlist"],
            'alrem': settings.ALLOW_REN["mus"],
            'alrepm': settings.ALLOW_REPM,
        })
    raise Http404("Нету такого плейлиста")

def youtube(req):
    
    if req.method == "POST":
        try:
            url = req.POST.get('url')
            floder = req.POST.get('fl')
            crfl = req.POST.get('plname')
            local_files = req.FILES.getlist('local_files')

            if not url and not local_files:
                raise Http404("Вы не вставили ссылки и не выбрали файлы для загрузки")
                
            if floder == "₡₹€ate" and crfl:
                os.makedirs(safe_join(music_dir, crfl), exist_ok=True)
                floder = crfl

            if floder and floder.strip():
                output_dir = safe_join(music_dir, floder.strip())
            else:
                output_dir = music_dir
                
            os.makedirs(output_dir, exist_ok=True)
            
            if url:
                urls = [u.strip() for u in url.split(" ") if u.strip()]
                for i in urls:
                    url_lower = i.lower()
                    
                    # 1. ОБРАБОТКА YOUTUBE (Оригинальный сырой формат)
                    if "youtube.com" in url_lower or "youtu.be" in url_lower:
                        try:
                            yt = YouTube(i, use_oauth=False, allow_oauth_cache=False)
                            audio = yt.streams.get_audio_only()
                            
                            if audio:
                                # Библиотека сама сохранит файл с его родным расширением (.m4a/.webm)
                                downloaded_file = audio.download(output_path=output_dir)
                                print(f"YouTube трек скачан в оригинальном формате: {downloaded_file}")
                            else:
                                print(f"Не удалось найти аудиопоток для {i}")
                        except Exception as e:
                            print(f"Ошибка pytubefix при обработке [{i}]: {e}")
                    
                    # 2. ОБРАБОТКА ДРУГИХ САЙТОВ (Оригинальный сырой формат)
                    else:
                        ydl_opts = {
                            'format': 'bestaudio',
                            'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
                            'quiet': True,
                        }
                
                        try:
                            print(f"Скачивание через yt-dlp: {i}")
                            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                                # Скачиваем файл. yt-dlp автоматически подставит правильное расширение сайта
                                ydl.download([i])
                        except yt_dlp.utils.DownloadError as dl_err:
                            print(f"Ошибка или сайт не подтверждается [{i}]: {dl_err}")
                        except Exception as e:
                            print(f"Ошибка при обработке URL [{i}]: {e}")

            if local_files:
                for f in local_files:
                    # Расширяем проверку, так как теперь мы поддерживаем разные сырые форматы медиа
                    if not f.name.lower().endswith(('.mp3', '.m4a', '.webm', '.ogg', '.wav')):
                        print(f"Файл {f.name} пропущен: неподдерживаемый аудио-формат")
                        continue
                    
                    file_path = safe_join(output_dir, f.name)
                    
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    
                    with open(file_path, 'wb+') as destination:
                        for chunk in f.chunks():
                            destination.write(chunk)
            
            return redirect("main")
            
        except Exception as e:
            print("Error in youtube view:", e)
            raise Http404(f"Ошибка: {e}")
            
    else:
        if os.path.exists(music_dir):
            return render(req, "yt.html", context={"pllt": [f for f in os.listdir(music_dir) if os.path.isdir(safe_join(music_dir, f))]})
        return render(req, "yt.html", context={"pllt":[]})

def ExportSystem(req):
    if not settings.EXPORT["status"]:
        raise Http404("Экспорт отключен в настройках")
    import zipfile
    music_dir = safe_join(settings.MEDIA_ROOT, "music")
    archP = safe_join(settings.CACHE_ROOT, "cache_mus.zip")
    txtP = safe_join(settings.CACHE_ROOT, "musBuildTime.txt")
    
    # Функция для сборки архива на максималках
    def build_extreme_zip():
        with zipfile.ZipFile(archP, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
            for root, dirs, files in os.walk(music_dir):
                for file in files:
                    file_path = safe_join(root, file)
                    relative_path = os.path.relpath(file_path, music_dir)
                    zipf.write(file_path, relative_path)

    # 1. Если папки кэша нет — создаем структуру
    if not os.path.exists(settings.CACHE_ROOT):
        os.makedirs(settings.CACHE_ROOT, exist_ok=True)

    # 2. Проверяем валидность существующего кэша
    cache_valid = False
    if os.path.exists(txtP) and os.path.exists(archP):
        with open(txtP, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            if content and os.path.getmtime(music_dir) <= float(content):
                cache_valid = True
            
    # 3. Если кэш невалиден или файла нет — пересобираем
    if not cache_valid:
        build_extreme_zip()
        with open(txtP, 'w', encoding='utf-8') as f:
            f.write(str(os.path.getmtime(archP)))
        
    # 4. Открываем файл для отправки (точка выхода теперь ОДНА для всех сценариев)
    response = FileResponse(open(archP, 'rb'), as_attachment=True, filename='musiclist.zip')

    # 5. Если кэш отключен, переопределяем close() для удаления ПОСЛЕ скачивания
    if not settings.EXPORT["cache_mus"]:
        original_close = response.close
        
        def remove_cache_files():
            try:
                original_close()  # Waitress сообщает, что закончил читать файл
            finally:
                if os.path.exists(archP): os.remove(archP)
                if os.path.exists(txtP): os.remove(txtP)
                
        response.close = remove_cache_files
        
    return response

def delete_track(request):
    if settings.ALLOW_DEL["mus"]:
        if request.method == 'DELETE':
            track_name = request.GET.get('track')       # Например: "song.mp3"
            playlist_name = request.GET.get('playlist') # Например: "Rock" или None

            # 2. Если песня в плейлисте (в подпапке), добавляем имя папки
            if playlist_name:
                file_path = safe_join(music_dir, playlist_name, track_name)
            else:
                file_path = safe_join(music_dir, track_name)

            # 3. Проверяем существование файла и удаляем его
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    return JsonResponse({'status': 'deleted'})
                except Exception as e:
                    return JsonResponse({'error': f'Не удалось удалить файл: {str(e)}'}, status=500)
            else:
                return JsonResponse({'error': 'Файл не найден на сервере'}, status=404)

        return JsonResponse({'error': 'Неверный метод запроса'}, status=400)
    return JsonResponse({'fatalerror': 'Удалять музыку через сайт нельзя'}, status=403)

def delete_pl(request):
    if settings.ALLOW_DEL["playlist"]:
        if request.method == 'DELETE':
            try:
                plN = request.GET.get('playlist')
                if plN:
                    filePth = safe_join(music_dir, plN)
                else:
                    return JsonResponse({'error': f'Не удалось прочитать путь'}, status=500)
                if (not os.path.exists(filePth)):
                    return JsonResponse({'error': f'Плейлист с именем {plN}({filePth}) не существует'}, status=403)
            except Exception as e:
                return JsonResponse({'error': f'Произошла ошибка для оформления запроса [{e}]'}, status=500)
            try:
                shutil.rmtree(filePth, ignore_errors=True)
                return JsonResponse({'success': f'Плейлист {plN} был успешно удалён!'}, status=200)
            except Exception as e:
                return JsonResponse({'error': f'shutil не смог удалить плейлист [{e}]'}, status=500)
        else:
            return JsonResponse({'error': f'Не удалось прочитать запрос'}, status=500)
    else:
        return JsonResponse({'fatalerror': 'Удалять плейлист через сайт нельзя'}, status=403)

def rename_pl(req):
    if settings.ALLOW_REN["playlist"]:
        if req.method == 'RENAME':
            try:
                plN = req.GET.get('playlist')
                NN = req.GET.get('new_name')
                if not NN:
                    return JsonResponse({'error': 'Нету имени для переименования'}, status=403)
                if plN:
                    filePth = safe_join(music_dir, plN)
                else:
                    return JsonResponse({'error': f'Не удалось прочитать путь'}, status=500)
                if (not os.path.exists(filePth)):
                    return JsonResponse({'error': f'Плейлист с именем {plN}({filePth}) не существует'}, status=403)
            except Exception as e:
                return JsonResponse({'error': f'Произошла ошибка для оформления запроса [{e}]'}, status=500)
            try:
                os.rename(filePth, safe_join(music_dir, NN))
                return JsonResponse({'success': f'Плейлист {plN} был успешно переименён!'}, status=200)
            except Exception as e:
                return JsonResponse({'error': f'os не смог переименовать плейлист [{e}]'}, status=500)
        else:
            return JsonResponse({'error': f'Не удалось прочитать запрос'}, status=500)
    else:
        return JsonResponse({'fatalerror': 'Переименовать плейлист через сайт нельзя'}, status=403)

def rename_mus(req):
    if settings.ALLOW_REN["mus"]:
        if req.method == 'RENAME':
            try:
                musN = unquote(req.GET.get('mus', '')).strip()
                plN = unquote(req.GET.get('playlist', '')) if req.GET.get('playlist') else None
                NN = unquote(req.GET.get('new_name', '')).strip()
                
                if not musN:
                    return JsonResponse({'error': 'Не указано имя исходного файла'}, status=400)
                if not NN:
                    return JsonResponse({'error': 'Нету имени для переименования'}, status=403)
                
                # УДАЛЕНО: принудительное добавление .mp3
                # Вместо этого автоматически сохраняем оригинальное расширение файла
                ext = os.path.splitext(musN)[1].lower()  # Получим '.mp3' или '.m4a'
                
                # Если пользователь в новом имени не указал расширение, добавляем родное
                if not NN.lower().endswith(('.mp3', '.m4a')):
                    NN = f"{NN}{ext}"
                
                if plN:
                    filePth = safe_join(music_dir, plN, musN)
                    nfilepth = safe_join(music_dir, plN, NN)
                else:
                    filePth = safe_join(music_dir, musN)
                    nfilepth = safe_join(music_dir, NN)
                
                if not os.path.exists(filePth):
                    return JsonResponse({'error': f'Музыка с именем {musN} не существует'}, status=404)
                if os.path.exists(nfilepth):
                    return JsonResponse({'error': f'Музыка с именем {NN} уже существует'}, status=403)
                    
            except Exception as e:
                return JsonResponse({'error': f'Произошла ошибка для оформления запроса [{e}]'}, status=500)
                
            try:
                os.rename(filePth, nfilepth)
                return JsonResponse({'success': f'Музыка {musN} была успешно переименована в {NN}!'}, status=200)
            except Exception as e:
                return JsonResponse({'error': f'os не смог переименовать музыку [{e}]'}, status=500)
        else:
            return JsonResponse({'error': 'Не удалось прочитать запрос'}, status=500)
    else:
        return JsonResponse({'fatalerror': 'Переименовать музыку через сайт нельзя'}, status=403)

def replace(req):
    if settings.ALLOW_REPM:
        if req.method == 'REPLACE':
            try:
                musN = unquote(req.GET.get('mus', '')).strip()
                plN = unquote(req.GET.get('playlist', '')) if req.GET.get('playlist') else None
                plNN = unquote(req.GET.get('new_pl', '')) if req.GET.get('new_pl') else None
                
                if not musN:
                    return JsonResponse({'error': 'Не указано имя файла музыки'}, status=400)

                if plN == plNN:
                    return JsonResponse({'fatalerror': 'Не нужно перемещать в тот же плейлист'}, status=403)
                
                # Определяем папки для поиска и перемещения
                source_dir = safe_join(music_dir, plN) if plN else music_dir
                target_dir = safe_join(music_dir, plNN) if plNN else music_dir

                # Автоподбор расширения (.mp3/.m4a), если имя пришло без него
                if not musN.lower().endswith(('.mp3', '.m4a')):
                    if os.path.exists(source_dir):
                        found_files = [
                            f for f in os.listdir(source_dir) 
                            if os.path.splitext(f)[0] == musN and f.lower().endswith(('.mp3', '.m4a'))
                        ]
                        if found_files:
                            musN = found_files[0]

                # Собираем финальные пути к файлам
                fileP = safe_join(source_dir, musN)
                filePn = Path(safe_join(target_dir, musN))
                    
                if not os.path.exists(fileP):
                    return JsonResponse({'error': 'Файл музыки в исходном плейлисте не существует'}, status=403)
                    
                if not os.path.exists(filePn.parent):
                    return JsonResponse({'error': 'Плейлист выхода не существует'}, status=403)
                    
                if os.path.exists(filePn):
                    return JsonResponse({'error': 'В целевом плейлисте уже существует музыка с таким именем'}, status=403)
                    
            except Exception as e:
                return JsonResponse({'error': f'Произошла ошибка для оформления запроса [{e}]'}, status=500)
                
            try:
                os.replace(fileP, filePn)
                return JsonResponse({'success': f'Музыка {musN} была успешно перемещена!'}, status=200)
            except Exception as e:
                return JsonResponse({'error': f'os не смог переместить музыку [{e}]'}, status=500)
        else:
            return JsonResponse({'error': 'Не удалось прочитать запрос (неверный метод)'}, status=400)
    else:            
        return JsonResponse({'fatalerror': 'Перемещать музыку через сайт нельзя'}, status=403)