"""
Backend API Tests - Health Check Only
MongoDB has been removed. Backend only serves /api/ and /api/health endpoints.
All data processing is now client-side.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthEndpoints:
    """Test the minimal backend API - health check only"""
    
    def test_health_endpoint_returns_ok(self):
        """GET /api/health should return status: ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
    
    def test_root_api_endpoint_returns_message(self):
        """GET /api/ should return welcome message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "upload CSVs" in data["message"].lower() or "entity" in data["message"].lower()
    
    def test_no_mongodb_endpoints_exist(self):
        """Verify old MongoDB-dependent endpoints no longer exist"""
        # These endpoints should return 404 since MongoDB was removed
        old_endpoints = [
            "/api/entities",
            "/api/funds",
            "/api/relations",
            "/api/upload",
        ]
        for endpoint in old_endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            # Should return 404 or 405 (not found or method not allowed)
            assert response.status_code in [404, 405, 422], f"Endpoint {endpoint} should not exist, got {response.status_code}"
