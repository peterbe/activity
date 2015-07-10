# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0002_project_github_path'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='guid',
            field=models.CharField(default='', max_length=32),
            preserve_default=False,
        ),
    ]
