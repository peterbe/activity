import datetime
import hashlib
import random
import time
import logging
from pprint import pprint

import requests
from celery.task import task
import arrow

from django.core.cache import cache
from django.conf import settings
from django.utils import timezone

from activity.events.models import Project, Event, Person


logger = logging.getLogger('activity.tasks')


def donothing(*args):
    pass


def fetch(url, params=None, expires=60 * 10):
    cache_key = hashlib.md5(url + str(params)).hexdigest()
    value = cache.get(cache_key)
    if value is None:
        r = requests.get(url, params=params or {})
        assert r.status_code == 200, r.status_code
        value = r.json()
        if expires:
            cache.set(cache_key, value, expires)
    return value


@task()
def populate_github_events(project_id, log=logger.info):
    project = Project.objects.get(id=project_id)

    def fetch_github_name(username):
        user_info = fetch(
            'https://api.github.com/users/{}'.format(username)
        )
        return user_info.get('name')

    if not project.github_path:
        logger.warning('{} has no github_path'.format(repr(project)))
        return
    owner, repo = project.github_path.split('/')
    events_url = (
        'https://api.github.com/repos/{owner}/{repo}/events'.format(
            owner=owner,
            repo=repo
        )
    )
    github_events = fetch(events_url)
    log('{} {}'.format(repr(project), len(github_events)))
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
            try:
                sha = event['payload']['commits'][0]['sha']
            except IndexError:
                logger.warning('PushEvent without a single commit!')
                logger.warning(event)
                logger.warning(events_url)
                continue
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
            meta['action'] = event['payload']['action']
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
        elif event['type'] == 'MemberEvent':
            # a new member added to the org
            continue
        else:
            pprint(event)
            raise NotImplementedError(event['type'])
        date = arrow.get(event['created_at']).datetime
        print "CREATED", Event.objects.create(
            guid=guid,
            project=project,
            person=person,
            date=date,
            type='github',
            url=url,
            meta=meta
        )

@task()
def populate_bugzilla_events(project_id, log=logger.info, slowly=False):
    assert isinstance(project_id, (long, int)), type(project_id)
    project = Project.objects.get(id=project_id)

    if not project.bugzilla_product:
        log("Project", repr(project), "has no bugzilla_product")
        return

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
        populate_bugzilla_comments.delay(
            project.id,
            bug,
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


@task()
def populate_bugzilla_comments(project_id, bug, log=logger.info):
    project = Project.objects.get(id=project_id)
    # import random
    # if random.randint(1, 25)!=1:
    #     return
    log("Fetch comments", bug['id'])
    url = 'https://bugzilla.mozilla.org/rest/bug/{}/comment'.format(bug['id'])
    comments = fetch(url)['bugs'][str(bug['id'])]['comments']

    for i, comment in enumerate(comments):
        guid = 'bugzilla-comment-{}'.format(comment['id'])
        log("\tBUG COMMENT", comment['creator'], repr(comment['text'][:70]))
        if comment['creator'] in settings.IGNORED_BUG_COMMENTORS:
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
