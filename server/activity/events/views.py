import hashlib
import cgi

import arrow

from django import http

from activity.events.models import Project, Event
from activity.events import tasks


def add_cors_header(value):
    def decorator(f):
        def inner(*args, **kwargs):
            response = f(*args, **kwargs)
            response['Access-Control-Allow-Origin'] = value
            return response
        return inner
    return decorator


def escape(obj):
    for k, value in obj.__dict__.items():
        if isinstance(value, basestring):
            obj.__dict__[k] = cgi.escape(value)
        elif hasattr(value, '__dict__'):
            obj.__dict__[k] = escape(value)
    return obj


class DotDict(dict):

    def __init__(self, *args, **kwargs):
        dict.__init__(self, *args, **kwargs)
        self._wrap_internal_dicts()

    def _wrap_internal_dicts(self):
        for key, value in self.items():
            if isinstance(value, dict):
                self[key] = DotDict(value)

    def __getattr__(self, key):
        if key.startswith('__'):
            raise AttributeError(key)
        return self[key]


def simplify_event(event):
    event.meta = DotDict(event.meta)

    person = event.person
    heading = (
        person.name or
        person.github or
        person.bugzilla or
        person.irc or
        person.email
    )

    if event.person.github_avatar_url:
        event.img = event.person.github_avatar_url
    elif event.person.email:
        event.img = (
            '//www.gravatar.com/avatar/' +
            hashlib.md5(event.person.email.lower()).hexdigest() + '?'
        )
    else:
        print "What about this one?!"

    text = u''
    if event.type == 'bugzilla-comment':
        text += 'Bugzilla Comment<br>'
        text += (
            u'<a href="{event.url}" title="{event.meta.text}">'
            u'<b>{event.meta.id}</b> {event.meta.summary}</a>'.format(
                event=escape(event)
            )
        )
    elif event.type == 'bugzilla-bug':
        text += 'Bugzilla Bug<br>'
        text += (
            u'<a href="{event.url}" title="{event.meta.summary}">'
            u'<b>{event.meta.id}</b> {event.meta.summary}</a>'.format(
                event=escape(event)
            )
        )
    elif event.type == 'github':
        if event.meta['type'] == 'PushEvent':
            text += 'GitHub Push<br>'
            for commit in event.meta['commits']:
                text += (
                    u'<a href="{commit.url}" title="{commit.message}">'
                    u'{commit.message}</a><br>'.format(
                        commit=escape(DotDict(commit))
                    )
                )
        elif event.meta['type'] == 'PullRequestEvent':
            text += 'GitHub Pull Request<br>'
            # XXX This should probably be {event.meta.pull_request.title}
            text += (
                u'<a href="{event.url}" title="{event.meta.title}">'
                u'{event.meta.title}</a>'.format(
                    event=escape(event)
                )
            )
        elif event.meta['type'] == 'IssueCommentEvent':
            text += 'GitHub Issue Comment<br>'
            text += (
                u'<a href="{event.url}" title="{event.meta.issue.title}">'
                u'{event.meta.issue.title}</a>'.format(
                    event=escape(event)
                )
            )
        elif event.meta['type'] == 'IssuesEvent':
            text += 'GitHub Issue <b>{event.meta.issue.action}</b>'.format(
                event=escape(event)
            )
            text += (
                u'<a href="{event.url}">{event.meta.issue.title}'
                u'</a>'.format(
                    event=escape(event)
                )
            )
        elif event.meta['type'] == 'PullRequestReviewCommentEvent':
            text += 'GitHub Pull Request Comment<br>'
            text += (
                u'<a href="{event.url}" '
                u'title="{event.meta.pull_request.title}">'
                u'{event.meta.pull_request.title}</a>'.format(
                    event=escape(event)
                )
            )
        elif event.meta['type'] == 'CreateEvent':
            text = 'GitHub<br>'
            if event.meta['create'].get('branch'):
                text += (
                    u'<a href="{event.url}">Created branch '
                    u'{event.meta.create.branch}</a>'.format(
                        event=escape(event)
                    )
                )
            elif event.meta['create'].get('tag'):
                text += (
                    u'<a href="{event.url}">Created tag '
                    u'{event.meta.create.tag}</a>'.format(
                        event=escape(event)
                    )
                )
            else:
                print "Created What??", event
                text += (
                    u'<a href="{event.url}">Created something</a>'.format(
                        event=escape(event)
                    )
                )
        elif event.meta['type'] == 'DeleteEvent':
            if event.meta['delete'].get('branch'):
                text += (
                    u'Deleted branch <b>{event.meta.delete.branch}</b>'.format(
                        event=escape(event)
                    )
                )
            else:
                print "Delete what?!"

        else:
            print "What about", event.meta['type'], event.url
            text = 'GitHub'
    else:
        text = event.type

    if event.img:
        if event.img[-1] == '?':
            event.img += 's=32'

    return {
        'id': event.id,
        'date': event.date.isoformat(),
        'heading': heading,
        'text': text,
        'img': event.img,
        'project': {
            'name': event.project.name,
            'url': event.project.url,
        }
    }


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
    page_size = 100
    events = events[(page - 1) * page_size: page * page_size]

    items = []
    # persons = ()

    for event in events:
        items.append(simplify_event(event))

    print "Returning", events.count(), len(items)
    return http.JsonResponse({
        'count': events.count(),
        'items': items,
    })
