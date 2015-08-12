import fanout

from django.utils import timezone
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.functional import LazyObject
from django.conf import settings

from jsonfield import JSONField

from activity.events.utils import simplify_event


class FanoutConnection(LazyObject):
    def _setup(self):
        print "SETTING UP FanoutConnection"
        fanout.realm = settings.FANOUT_REALM
        fanout.key = settings.FANOUT_KEY
        self._wrapped = fanout

fanoutconnection = FanoutConnection()


class Project(models.Model):
    name = models.CharField(max_length=100)
    url = models.URLField(blank=True)
    github_path = models.CharField(max_length=200, blank=True)
    bugzilla_component = models.CharField(max_length=100, null=True)
    bugzilla_product = models.CharField(max_length=100, null=True)

    def __repr__(self):
        return '<{}: {!r}>'.format(self.__class__.__name__, self.name)


class Person(models.Model):
    name = models.CharField(max_length=200, null=True)
    github = models.CharField(max_length=200, null=True)
    bugzilla = models.CharField(max_length=200, null=True)
    irc = models.CharField(max_length=200, null=True)
    email = models.EmailField(null=True)
    alias = models.ForeignKey('Person', null=True)
    github_avatar_url = models.URLField(null=True)


class Event(models.Model):
    project = models.ForeignKey(Project)
    person = models.ForeignKey(Person)
    date = models.DateTimeField(default=timezone.now)
    type = models.CharField(max_length=100)
    url = models.URLField()
    # can be a md5 hash or something
    guid = models.CharField(max_length=32, db_index=True, unique=True)
    meta = JSONField()

    def __repr__(self):
        return '<%s: %s %s>' % (
            self.__class__.__name__,
            self.type,
            self.date
        )


@receiver(post_save, sender=Event)
def publish_new_event(sender, instance, created=False, **kwargs):
    if not created:
        return
    simplified = simplify_event(instance)
    print "PUBLISHING", instance.project.name
    print simplified
    print
    fanoutconnection.publish('activity', simplified)
