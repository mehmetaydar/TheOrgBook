from django.db import models
from django.utils import timezone

from auditable.models import Auditable

# from .Credential import Credential
from .Topic import Topic


class TopicRelationship(Auditable):
    credential = models.ForeignKey("Credential", related_name="+", on_delete=models.CASCADE)
    topic = models.ForeignKey(Topic, related_name="+", on_delete=models.CASCADE)
    related_topic = models.ForeignKey(Topic, related_name="+", on_delete=models.CASCADE)

    class Meta:
        db_table = "topic_relationship"
