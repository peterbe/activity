from django.core.management.base import BaseCommand, CommandError

from activity.events.views import populate_github_events
from activity.events.models import Project


class Command(BaseCommand):

    def add_arguments(self, parser):
        parser.add_argument('projects', nargs='+')

    def handle(self, *args, **options):
        projects = Project.objects.filter(name__in=options['projects'])
        if projects.count() != len(projects):
            raise CommandError('Some projects not recognized')
        populate_github_events(projects, verbose=True)
