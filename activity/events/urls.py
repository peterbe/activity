from django.conf.urls import patterns, url

from . import views

urlpatterns = patterns(
    '',
    url('(?P<projects>[\w,\s]+)', views.events, name='events'),
)
