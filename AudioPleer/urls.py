"""
URL configuration for AudioPleer project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, re_path,include
from django.views.static import serve
from django.conf import settings
from main import views

urlpatterns = [
    path('', views.main, name="main"),
    path('playlist/<str:playlist>', views.openPlaylist, name="playlist"),
    path('download/', views.youtube),
    path('export/', views.ExportSystem),
    path('delete-track/', views.delete_track, name='delete_track'),
    path('delete-pl/', views.delete_pl, name='delete_pl'),
    path('rename-pl/', views.rename_pl, name='rename-pl'),
    path('rename-mus/', views.rename_mus, name='rename-mus'),
    path('replace-mus/', views.replace, name="replace"),

    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
