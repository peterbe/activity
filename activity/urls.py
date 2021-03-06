from django.conf.urls import include, url, patterns

import djcelery

urlpatterns = patterns(
    '',
    url(
        r'events/',
        include('activity.events.urls', namespace='events')
    ),
)# + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

djcelery.setup_loader()
