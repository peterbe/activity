from django.core.management.base import BaseCommand, CommandError

from activity.events.views import populate_bugzilla_events
from activity.events.models import Project


class Command(BaseCommand):

    def add_arguments(self, parser):
        parser.add_argument('projects', nargs='+')
        parser.add_argument(
            '--slowly',
            action='store_true',
            dest='slowly',
            default=False,
            help='Put some pauses in to slow down requests'
        )

    def handle(self, *args, **options):
        projects = Project.objects.filter(name__in=options['projects'])
        if projects.count() != len(projects):
            raise CommandError('Some projects not recognized')

        def verbose(*args):
            for arg in args:
                print arg,
            print

        populate_bugzilla_events(
            projects,
            log=verbose,
            slowly=options['slowly']
        )
