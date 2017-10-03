import json

from django.conf.urls import url
from django.contrib import messages
from django.core.exceptions import FieldError, ValidationError
from django.http import HttpResponse
from django.views.generic import TemplateView

from .compat import text_type
from .exceptions import DjangoQLError
from .models import SavedQuery
from .queryset import apply_search
from .schema import DjangoQLSchema


class DjangoQLSearchMixin(object):
    search_fields = ('_djangoql',)  # just a stub to have search input displayed
    djangoql_completion = True
    djangoql_schema = DjangoQLSchema
    djangoql_syntax_help_template = 'djangoql/syntax_help.html'

    def get_search_results(self, request, queryset, search_term):
        use_distinct = False
        if not search_term:
            return queryset, use_distinct
        try:
            return (
                apply_search(queryset, search_term, self.djangoql_schema),
                use_distinct,
            )
        except (DjangoQLError, ValueError, FieldError) as e:
            msg = text_type(e)
        except ValidationError as e:
            msg = e.messages[0]
        queryset = queryset.none()
        messages.add_message(request, messages.WARNING, msg)
        return queryset, use_distinct

    @property
    def media(self):
        media = super(DjangoQLSearchMixin, self).media
        if self.djangoql_completion:
            media.add_js((
                'djangoql/js/lib/lexer.js',
                'djangoql/js/completion.js',
                'djangoql/js/completion_admin.js',
                'djangoql/js/save_query.js',
            ))
            media.add_css({'': (
                'djangoql/css/completion.css',
                'djangoql/css/completion_admin.css',
                'djangoql/css/save_query.css',
            )})
        return media

    def get_urls(self):
        custom_urls = []
        if self.djangoql_completion:
            custom_urls += [
                url(
                    r'^introspect/$',
                    self.admin_site.admin_view(self.introspect),
                    name='%s_%s_djangoql_introspect' % (
                        self.model._meta.app_label,
                        self.model._meta.model_name,
                    ),
                ),
                url(
                    r'^djangoql-syntax/$',
                    TemplateView.as_view(
                        template_name=self.djangoql_syntax_help_template,
                    ),
                    name='djangoql_syntax_help',
                ),
                url(
                    r'^djangoql-save-query/$',
                    self.admin_site.admin_view(self.save_query)
                ),
                url(
                    r'^djangoql-query-list/$',
                    self.admin_site.admin_view(self.query_list)
                ),
                url(
                    r'^djangoql-delete-query/$',
                    self.admin_site.admin_view(self.delete_query)
                ),
            ]
        return custom_urls + super(DjangoQLSearchMixin, self).get_urls()

    def introspect(self, request):
        response = self.djangoql_schema(self.model).as_dict()
        return HttpResponse(
            content=json.dumps(response, indent=2),
            content_type='application/json; charset=utf-8',
        )

    def _serialize_query(self, queryset):
        return [
            dict(id=id, name=name, text=text)
            for id, name, text in queryset.values_list('id', 'name', 'query')
        ]

    def query_list(self, request):
        own_queries = SavedQuery.objects.filter(user=request.user).order_by('-id')
        public_queries = SavedQuery.objects.exclude(user=request.user).filter(is_public=True).order_by('-id')
        response = dict(
            own=self._serialize_query(own_queries),
            public=self._serialize_query(public_queries),
        )
        return HttpResponse(
            content=json.dumps(response, indent=2),
            content_type='application/json; charset=utf-8',
        )

    def save_query(self, request):
        status = 400
        response = {}
        if request.is_ajax():
            query = request.GET.get('query')
            name = request.GET.get('name')
            is_public = request.GET.get('is_public', False) == 'true'
            user = request.user
            if query and name and user.is_authenticated:
                new_query = SavedQuery.objects.create(
                    query=query, name=name, is_public=is_public, user=request.user
                )
                response = dict(
                    query_id=new_query.pk,
                    query_text=new_query.query,
                )
                status = 201
        return HttpResponse(
            content=json.dumps(response, indent=2),
            content_type='application/json; charset=utf-8',
            status=status
        )

    def delete_query(self, request):
        # using GET to avoid a mess with a csrf token
        status = 400
        if request.is_ajax():
            query_id = request.GET.get('query_id')
            count = SavedQuery.objects.filter(pk=query_id, user=request.user).delete()
            status = 204 if count else 404
        return HttpResponse(status=status)
