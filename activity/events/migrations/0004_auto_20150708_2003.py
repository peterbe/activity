# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0003_event_guid'),
    ]

    operations = [
        migrations.AlterField(
            model_name='event',
            name='guid',
            field=models.CharField(unique=True, max_length=32, db_index=True),
        ),
    ]
