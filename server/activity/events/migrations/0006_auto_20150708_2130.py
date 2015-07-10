# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0005_person_github_avatar_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='bugzilla_component',
            field=models.CharField(max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='project',
            name='bugzilla_product',
            field=models.CharField(max_length=100, null=True),
        ),
    ]
