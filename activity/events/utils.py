import hashlib

from django.template import Template, Context


TEMPLATES = {}
TEMPLATES['bugzilla-comment'] = Template("""
    Bugzilla Comment<br>
    <a href="{{event.url}}" title="{{event.meta.text}}"
    ><b>{{event.meta.id}}</b> {{event.meta.summary}}</a>
""")

TEMPLATES['bugzilla-bug'] = Template("""
    Bugzilla Bug<br>
    <a href="{{event.url}}" title="{{event.meta.summary}}"
    ><b>{{event.meta.id}}</b> {{event.meta.summary}}</a>
""")

TEMPLATES['github'] = Template("""
    {% if event.meta.type == 'PushEvent' %}
        GitHub Push<br>
        {% for commit in event.meta.commits %}
            <a href="{{commit.url}}" title="{{commit.message}}"
            >{{commit.message}}</a><br>
        {% endfor %}
    {% elif event.meta.type == 'PullRequestEvent' %}
        GitHub Pull Request<br>
        <a href="{{event.url}}" title="{{event.meta.title}}"
        >{{event.meta.title}}</a>
    {% elif event.meta.type == 'IssueCommentEvent' %}
        GitHub Issue Comment<br>
        <a href="{{event.url}}" title="{{event.meta.issue.title}}"
        >{{event.meta.issue.title}}</a>
    {% elif event.meta.type == 'IssuesEvent' %}
        GitHub Issue <b>{{event.meta.issue.action}}</b><br>
        <a href="{{event.url}}">{{event.meta.issue.title}}</a>
    {% elif event.meta.type == 'PullRequestReviewCommentEvent' %}
        GitHub Pull Request Comment<br>
        <a href="{{event.url}}" title="{{event.meta.pull_request.title}}"
        >{{event.meta.pull_request.title}}</a>
    {% elif event.meta.type == 'CreateEvent' %}
        GitHub<br>
        {% if event.meta.create.branch %}
            <a href="{{event.url}}">Created branch
            <b>{{event.meta.create.branch}}</b></a>
        {% elif event.meta.create.tag %}
            <a href="{{event.url}}">Created tag
            <b>{{event.meta.create.tag}}</b></a>
        {% else %}
        WHAT?!
        {% endif %}
    {% elif event.meta.type == 'DeleteEvent' %}
        {% if event.meta.delete.branch %}
            Deleted branch <b>{{event.meta.delete.branch}}</b>
        {% else %}
            Delete wat?
        {% endif %}

    {% else %}
        DON'T KNOW HOW TO RENDER {{ event.meta.type }}
    {% endif %}
""".strip())


def simplify_event(event):
    # print (event, event.type)
    # event.meta = DotDict(event.meta)

    person = event.person
    # heading = (
    #     person.name or
    #     person.github or
    #     person.bugzilla or
    #     person.irc or
    #     person.email
    # )

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
    context = Context({
        'event': event,
        # 'getitem': lambda d, k: d.get(k),
    })
    if event.type in TEMPLATES:
        text = TEMPLATES[event.type].render(context)
    else:
        text = event.type

    if event.img:
        if event.img[-1] == '?':
            event.img += 's=50'

    return {
        'id': event.id,
        'date': event.date.isoformat(),
        # 'heading': heading,
        'text': text.strip(),
        'img': event.img,
        'person': {
            'id': person.id,
            'name': person.name,
            'github': person.github,
            'bugzilla': person.bugzilla,
            'irc': person.irc,
            'email': person.email,
            'alias': person.alias,
        },
        'project': {
            'name': event.project.name,
            'url': event.project.url,
        }
    }
