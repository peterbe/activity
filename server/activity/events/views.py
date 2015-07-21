import datetime
import hashlib
from pprint import pprint

import requests
import arrow

from django.utils import timezone
from django.shortcuts import render
from django import http
from django.core.cache import cache
from django.db import transaction
from django.conf import settings

from activity.events.models import Project, Event, Person

def add_cors_header(value):
    def decorator(f):
        def inner(*args, **kwargs):
            response = f(*args, **kwargs)
            response['Access-Control-Allow-Origin'] = value
            return response
        return inner
    return decorator


def fetch(url, params=None, expires=60 * 60):
    cache_key = hashlib.md5(url + str(params)).hexdigest()
    value = cache.get(cache_key)
    if value is None:
        r = requests.get(url, params=params or {})
        assert r.status_code == 200, r.status_code
        value = r.json()
        if expires:
            cache.set(cache_key, value, expires)
    return value


@add_cors_header('*')
def events(request, projects):
    # replace ALL of this one day with DRF

    project_names = projects.split(',')
    projects = Project.objects.filter(name__in=project_names)
    if projects.count() != len(project_names):
        raise http.Http404('No known projects')

    populate_github_events(projects)  # should be triggered by a cron job
    populate_bugzilla_events(projects)  # should be triggered by a cron job

    events = (
        Event.objects.filter(project__in=projects)
        .select_related('person')
        .select_related('project')
        .order_by('-date')
    )
    page = int(request.GET.get('page', 1))
    page_size = 100
    events = events[(page - 1) * page_size: page * page_size]

    items = []
    persons = ()

    for event in events:
        item = {
            'guid': event.guid,
            'date': event.date.isoformat(),
            'type': event.type,
            'url': event.url,
            'person': {
                'name': event.person.name,
                'github': event.person.github,
                'bugzilla': event.person.bugzilla,
                'irc': event.person.irc,
                'email': event.person.email,
                'github_avatar_url': event.person.github_avatar_url,
            },
            'meta': event.meta or {},
            'project': {
                'name': event.project.name,
                'url': event.project.url,
            }
        }
        if event.person.github_avatar_url:
            item['img'] = event.person.github_avatar_url
        elif event.person.email:
            item['img'] = (
                '//www.gravatar.com/avatar/' +
                hashlib.md5(event.person.email.lower()).hexdigest() + '?'
            )
        items.append(item)
    return http.JsonResponse({
        'count': events.count(),
        'items': items,
    })


def populate_bugzilla_events(projects):
    for project in projects:
        if not project.bugzilla_product:
            continue

        # this only gives us filed bugs
        now = timezone.now()
        past = now - datetime.timedelta(days=90)
        url = 'https://bugzilla.mozilla.org/rest/bug'
        params = {
            'include_fields': (
                'product,component,creator,creator_details,status,id,'
                'resolution,summary,last_change_time,creation_time'
            ),
            'product': project.bugzilla_product,
            'creation_time': past.isoformat(),
            # 'limit': 100,
        }
        if project.bugzilla_component:
            params['component'] = project.bugzilla_component
        if settings.BUGZILLA_AUTH_TOKEN:
            params['token'] = settings.BUGZILLA_AUTH_TOKEN

        bugs = fetch(url, params)['bugs']
        pprint(bugs[0])
        pprint(bugs[1])
        pprint(bugs[3])
        for bug in bugs:
            guid = 'bugzilla-bug-{}'.format(bug['id'])
            populate_bugzilla_comments(project, bug)
            if Event.objects.filter(project=project, guid=guid).exists():
                continue

            person, _ = Person.objects.get_or_create(
                email=bug['creator_detail']['email']
            )
            if not person.bugzilla and bug['creator_detail']['real_name']:
                person.bugzilla = bug['creator_detail']['real_name']
                person.save()
            date = arrow.get(bug['creation_time']).datetime
            url = 'https://bugzilla.mozilla.org/show_bug.cgi?id={}'.format(
                bug['id']
            )
            # print bug['creation_time']
            Event.objects.create(
                guid=guid,
                project=project,
                person=person,
                url=url,
                date=date,
                type='bugzilla-bug',
                meta={
                    'id': bug['id'],
                    'status': bug['status'],
                    'resolution': bug['resolution'],
                    'summary': bug['summary'],
                }
            )

def populate_bugzilla_comments(project, bug):
    import random
    if random.randint(1, 25)!=1:
        return
    print "Fetch comments", bug['id']
    url = 'https://bugzilla.mozilla.org/rest/bug/{}/comment'.format(bug['id'])
    comments = fetch(url)['bugs'][str(bug['id'])]['comments']

    for i, comment in enumerate(comments):
        # print "COMMENT"
        # pprint(comment)
        guid = 'bugzilla-comment-{}'.format(comment['id'])
        if Event.objects.filter(project=project, guid=guid).exists():
            continue
        person, _ = Person.objects.get_or_create(
            email=comment['creator']
        )
        url = 'https://bugzilla.mozilla.org/show_bug.cgi?id={}#c{}'.format(
            comment['bug_id'],
            i
        )
        date = arrow.get(comment['creation_time']).datetime

        Event.objects.create(
            guid=guid,
            project=project,
            person=person,
            date=date,
            url=url,
            type='bugzilla-comment',
            meta={
                'id': bug['id'],
                'text': comment['text'],
                'summary': bug['summary'],
            }
        )


@transaction.atomic
def populate_github_events(projects):

    def fetch_github_name(username):
        user_info = fetch(
            'https://api.github.com/users/{}'.format(username)
        )
        return user_info.get('name')

    # items = []
    for project in projects:
        if not project.github_path:
            continue
        owner, repo = project.github_path.split('/')
        github_events = fetch(
            'https://api.github.com/repos/{owner}/{repo}/events'.format(
                owner=owner,
                repo=repo
            )
        )

        # pprint(github_events)
        for event in github_events:
            guid = 'github-event-{}'.format(event['id'])
            if Event.objects.filter(project=project, guid=guid).exists():
                continue

            person, _ = Person.objects.get_or_create(
                github=event['actor']['login']
            )
            if not person.github_avatar_url:
                person.github_avatar_url = event['actor']['avatar_url']
                person.save()
            if not person.name:
                name = fetch_github_name(event['actor']['login'])
                if name:
                    person.name = name
                    person.save()

            meta = {
                'type': event['type'],
            }

            if event['type'] == 'PushEvent':
                sha = event['payload']['commits'][0]['sha']
                # should we use the `before` and `after` instead to make
                # a compare url?
                url = 'https://github.com/{repo}/commit/{sha}'.format(
                    repo=event['repo']['name'],
                    sha=sha
                )
                meta['commits'] = event['payload']['commits']
            elif event['type'] == 'ReleaseEvent':
                url = event['payload']['release']['html_url']
            elif event['type'] == 'PullRequestEvent':
                url = event['payload']['pull_request']['html_url']
                meta['action']= event['payload']['action']
                if 'title' in event['payload']['pull_request']:
                    meta['title'] = event['payload']['pull_request']['title']
                if 'merge_commit_sha' in event['payload']:
                    meta['merge_commit_sha'] = (
                        event['payload']['merge_commit_sha']
                    )
            elif event['type'] == 'IssueCommentEvent':
                url = event['payload']['comment']['html_url']
                meta['issue'] = {
                    'title': event['payload']['issue']['title'],
                }
            elif event['type'] == 'PullRequestReviewCommentEvent':
                url = event['payload']['comment']['html_url']
                meta['pull_request'] = {
                    'title': event['payload']['pull_request']['title']
                }
            elif event['type'] == 'WatchEvent':
                # someone else started watching this repo
                continue
            elif event['type'] == 'ForkEvent':
                # just forking a repo isn't any real contribution
                continue
            elif (
                event['type'] == 'CreateEvent' and
                event['payload'].get('ref_type') == 'tag'
            ):
                url = 'https://github.com/{repo}/releases/tag/{tag}'.format(
                    repo=event['repo']['name'],
                    tag=event['payload']['ref'],
                )
                meta['tag'] = event['payload']['ref']
            elif (
                event['type'] == 'CreateEvent' and
                event['payload'].get('ref_type') == 'branch'
            ):
                print "Not sure what to do with these at the moment"
                print event['type']
                pprint(event['payload'])
                continue
            elif event['type'] == 'IssuesEvent':
                url = event['payload']['issue']['html_url']
                meta['issue'] = {
                    'action': event['payload']['action'],
                    'title': event['payload']['issue']['title'],
                }
            else:
                pprint(event)
                raise NotImplementedError(event['type'])
            date = arrow.get(event['created_at']).datetime
            Event.objects.create(
                guid=guid,
                project=project,
                person=person,
                date=date,
                type='github',
                url=url,
                meta=meta
            )
