"""
URL configuration for GroupBuy Bot Core API
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health_check(request):
    """Health check endpoint"""
    return JsonResponse({'status': 'healthy'})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health'),

    # API endpoints
    path('api/users/', include('users.urls')),
    path('api/procurements/', include('procurements.urls')),
    path('api/chat/', include('chat.urls')),
    path('api/payments/', include('payments.urls')),

    # API documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
