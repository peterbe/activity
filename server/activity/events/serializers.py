from rest_framework import serializers

from .models import Project, Person, Event


class EventSerializer(serializers.Serializer):
    pk = serializers.IntegerField(read_only=True)
    # blae!
