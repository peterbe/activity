import datetime
import hashlib
import cgi
import time
import random
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


IGNORED_BUG_COMMENTORS = (
    u'mozilla+bugcloser@davedash.com',
)


def donothing(*args):
    pass


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
    """
  // simplifyThing(thing) {
    thing.heading = thing.person.name ||
                    thing.person.github ||
                    thing.person.bugzilla ||
                    thing.person.irc ||
                    thing.person.email;

    thing.text = '';
    switch (thing.type) {
      case 'bugzilla-comment':
        thing.text += 'Bugzilla Comment<br>';
        thing.text += `<a href="${thing.url}"
          title="${thing.meta.text}"><b>${thing.meta.id}</b> ${thing.meta.summary}</a>`;
        break;
      case 'bugzilla-bug':
        thing.text += 'Bugzilla Bug<br>';
        thing.text += `<a href="${thing.url}"><b>${thing.meta.id}</b> ${thing.meta.summary}</a>`;
        break;
      case 'github':

        switch (thing.meta.type) {
          case 'PushEvent':
            thing.text += 'GitHub Push<br>'
            if (thing.meta.commits) {
              thing.meta.commits.forEach((commit) => {
                thing.text += `<a href="${commit.url}"
                  title="${commit.message}">${commit.message}</a><br>`;
              });
            }
            break;
          case 'PullRequestEvent':
            thing.text += 'GitHub Pull Request<br>'
            if (thing.meta.title) {
              thing.text += `<a href="${thing.url}"
                title="${thing.meta.title}">${thing.meta.title}</a>`;
            } else {
              thing.text += `<a href="${thing.url}">URL</a>`;
            }
            break;
          case 'IssueCommentEvent':
            thing.text += 'GitHub Issue Comment<br>'
            if (thing.meta.issue && thing.meta.issue.title) {
              thing.text += `<a href="${thing.url}"
                title="${thing.meta.issue.title}">${thing.meta.issue.title}</a>`;
            } else {
              thing.text += `<a href="${thing.url}"><i>No title</i></a>`;
            }

            break;
          case 'IssuesEvent':
            thing.text += 'GitHub Issue ';
            thing.text += `<b>${thing.meta.issue.action}</b><br>`;
            thing.text += `<a href="${thing.url}">${thing.meta.issue.title}</a>`
            break;
          case 'PullRequestReviewCommentEvent':
            thing.text += 'GitHub Pull Request Comment<br>';
            if (thing.meta.pull_request && thing.meta.pull_request.title) {
              thing.text += `<a href="${thing.url}">${thing.meta.pull_request.title}</a>`;
            } else {
              thing.text += `<a href="${thing.url}"><i>No title</i></a>`;
            }
            break;
          case 'CreateEvent':
            thing.text += 'GitHub<br>';
            if (thing.meta.tag) {
              thing.text += `<a href="${thing.url}">Create tag ${thing.meta.tag}</a>`;
            } else {
              thing.text += `<a href="${thing.url}">Create something</a>`;
            }
            break;
          default:
            console.log('What about', thing.meta.type, thing.url);
            console.log(thing.meta)
            thing.text += 'GitHub';

        }
      break;

      default:
        thing.text = thing.type;
    }
    // thing.heading = thing.type;
    if (thing.img) {
      if (thing.img.charAt(thing.img.length - 1) === '?') {
        thing.img += 's=32';
      }
    }
  }
    """

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
            #XXX This should probably be {event.meta.pull_request.title}
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

    # populate_github_events(projects)  # should be triggered by a cron job
    # populate_bugzilla_events(projects)  # should be triggered by a cron job

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
    persons = ()

    for event in events:
        items.append(simplify_event(event))

    print "Returning", events.count(), len(items)
    return http.JsonResponse({
        'count': events.count(),
        'items': items,
    })


def populate_bugzilla_events(projects, log=donothing, slowly=False):
    for project in projects:
        if not project.bugzilla_product:
            log("Project", repr(project), "has no bugzilla_product")
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
        for bug in bugs:
            log("BUG", repr(bug['summary']))
            guid = 'bugzilla-bug-{}'.format(bug['id'])
            populate_bugzilla_comments(
                project,
                bug,
                log=log,
            )
            if Event.objects.filter(project=project, guid=guid).exists():
                log("\tSkip!")
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
            if slowly:
                log("Pausing...")
                time.sleep(random.randint(3, 7))


def populate_bugzilla_comments(project, bug, log=donothing):
    # import random
    # if random.randint(1, 25)!=1:
    #     return
    log("Fetch comments", bug['id'])
    url = 'https://bugzilla.mozilla.org/rest/bug/{}/comment'.format(bug['id'])
    comments = fetch(url)['bugs'][str(bug['id'])]['comments']

    for i, comment in enumerate(comments):
        guid = 'bugzilla-comment-{}'.format(comment['id'])
        log("\tBUG COMMENT", comment['creator'], repr(comment['text'][:70]))
        if comment['creator'] in IGNORED_BUG_COMMENTORS:
            log("\t\tSkipping because creator ignored")
            continue
        if Event.objects.filter(project=project, guid=guid).exists():
            log("\t\tSkip")
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
def populate_github_events(projects, verbose=False):

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
        if verbose:
            print repr(project), len(github_events)
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
            elif event['type'] == 'CreateEvent':
                if event['payload']['ref_type'] == 'branch':
                    url = 'https://github.com/{repo}/tree/{ref}'.format(
                        repo=event['repo']['name'],
                        ref=event['payload']['ref'],
                    )
                    meta['create'] = {
                        event['payload']['ref_type']: event['payload']['ref']
                    }
                else:
                    print "Not sure what to do with these at the moment"
                    print event['type']
                    pprint(event['payload'])
                    continue
            elif event['type'] == 'DeleteEvent':
                # Not sure what to do with delete events because
                # they usually don't have a URL.
                url = 'https://github.com/{repo}'.format(
                    repo=event['repo']['name'],
                )
                meta['delete'] = {
                    event['payload']['ref_type']: event['payload']['ref']
                }
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
