import arrow

from django import http

from activity.events.models import Project, Event
from activity.events import tasks
from activity.events.utils import simplify_event


def add_cors_header(value):
    def decorator(f):
        def inner(*args, **kwargs):
            response = f(*args, **kwargs)
            response['Access-Control-Allow-Origin'] = value
            return response
        return inner
    return decorator


@add_cors_header('*')
def events(request, projects):
    # replace ALL of this one day with DRF

    project_names = projects.split(',')
    projects = Project.objects.filter(name__in=project_names)
    if projects.count() != len(project_names):
        raise http.Http404('No known projects')

    since = None
    if request.GET.get('since'):
        since = arrow.get(request.GET['since']).datetime
    else:
        for project in projects:
            tasks.populate_github_events.delay(project.id)
            tasks.populate_bugzilla_events.delay(project.id)

    events = (
        Event.objects.filter(project__in=projects)
        .select_related('person')
        .select_related('project')
        .order_by('-date')
    )
    if since:
        events = events.filter(date__gt=since)

    page = int(request.GET.get('page', 1))
    page_size = 300
    events = events[(page - 1) * page_size: page * page_size]

    items = []

    for event in events:
        items.append(simplify_event(event))

    return http.JsonResponse({
        'count': events.count(),
        'items': items,
    })
