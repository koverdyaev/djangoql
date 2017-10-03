from django.db import models
from django.conf import settings


class SavedQuery(models.Model):
    name = models.CharField(max_length=100)
    query = models.TextField()
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='saved_queries')
    is_public = models.BooleanField(default=False)
