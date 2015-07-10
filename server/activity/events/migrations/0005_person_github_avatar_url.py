# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0004_auto_20150708_2003'),
    ]

    operations = [
        migrations.AddField(
            model_name='person',
            name='github_avatar_url',
            field=models.URLField(null=True),
        ),
    ]
