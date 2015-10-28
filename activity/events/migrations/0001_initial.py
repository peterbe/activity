# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import django.utils.timezone
import jsonfield.fields


class Migration(migrations.Migration):

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Event',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('date', models.DateTimeField(default=django.utils.timezone.now)),
                ('type', models.CharField(max_length=100)),
                ('url', models.URLField()),
                ('meta', jsonfield.fields.JSONField()),
            ],
        ),
        migrations.CreateModel(
            name='Person',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(max_length=200, null=True)),
                ('github', models.CharField(max_length=200, null=True)),
                ('bugzilla', models.CharField(max_length=200, null=True)),
                ('irc', models.CharField(max_length=200, null=True)),
                ('email', models.EmailField(max_length=254, null=True)),
                ('alias', models.ForeignKey(to='events.Person', null=True)),
            ],
        ),
        migrations.CreateModel(
            name='Project',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(max_length=100)),
                ('url', models.URLField(blank=True)),
            ],
        ),
        migrations.AddField(
            model_name='event',
            name='person',
            field=models.ForeignKey(to='events.Person'),
        ),
        migrations.AddField(
            model_name='event',
            name='project',
            field=models.ForeignKey(to='events.Project'),
        ),
    ]
