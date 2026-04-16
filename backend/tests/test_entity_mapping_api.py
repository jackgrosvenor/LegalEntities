"""
Backend API Tests for PE Entity Mapping Application
Tests: Funds, Entities, Filters, Entity Detail, Fund Tree endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndRoot:
    """Test API root endpoint"""
    
    def test_api_root(self):
        """Test API root returns expected message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Entity Mapping API"


class TestFundsEndpoint:
    """Test GET /api/funds endpoint"""
    
    def test_get_funds_returns_list(self):
        """Test funds endpoint returns list of funds"""
        response = requests.get(f"{BASE_URL}/api/funds")
        assert response.status_code == 200
        data = response.json()
        assert "funds" in data
        assert isinstance(data["funds"], list)
    
    def test_get_funds_count(self):
        """Test funds endpoint returns 52 funds"""
        response = requests.get(f"{BASE_URL}/api/funds")
        assert response.status_code == 200
        data = response.json()
        assert len(data["funds"]) == 52
    
    def test_fund_structure(self):
        """Test each fund has fund_id and fund_name"""
        response = requests.get(f"{BASE_URL}/api/funds")
        assert response.status_code == 200
        data = response.json()
        for fund in data["funds"]:
            assert "fund_id" in fund
            assert "fund_name" in fund
            assert isinstance(fund["fund_id"], int)
            assert isinstance(fund["fund_name"], str)
    
    def test_fund_i_exists(self):
        """Test Fund I (fund_id=1) exists"""
        response = requests.get(f"{BASE_URL}/api/funds")
        assert response.status_code == 200
        data = response.json()
        fund_ids = [f["fund_id"] for f in data["funds"]]
        assert 1 in fund_ids
        fund_i = next(f for f in data["funds"] if f["fund_id"] == 1)
        assert fund_i["fund_name"] == "Fund I"


class TestEntitiesEndpoint:
    """Test GET /api/entities endpoint with search/filter params"""
    
    def test_get_entities_returns_paginated_list(self):
        """Test entities endpoint returns paginated list"""
        response = requests.get(f"{BASE_URL}/api/entities?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "entities" in data
        assert "total" in data
        assert isinstance(data["entities"], list)
        assert len(data["entities"]) <= 10
    
    def test_entities_total_count(self):
        """Test total entities count is 1756"""
        response = requests.get(f"{BASE_URL}/api/entities?limit=1")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1756
    
    def test_search_entities_by_name(self):
        """Test search filter by company name"""
        response = requests.get(f"{BASE_URL}/api/entities?search=Equitix&limit=50")
        assert response.status_code == 200
        data = response.json()
        assert len(data["entities"]) > 0
        for entity in data["entities"]:
            assert "equitix" in entity["COMPANY_NAME"].lower()
    
    def test_filter_by_jurisdiction(self):
        """Test filter by jurisdiction"""
        response = requests.get(f"{BASE_URL}/api/entities?jurisdiction=Guernsey&limit=50")
        assert response.status_code == 200
        data = response.json()
        for entity in data["entities"]:
            assert entity["JURISDICTION"] == "Guernsey"
    
    def test_filter_by_entity_type(self):
        """Test filter by entity type"""
        response = requests.get(f"{BASE_URL}/api/entities?entity_type=LimitedPartnership&limit=50")
        assert response.status_code == 200
        data = response.json()
        for entity in data["entities"]:
            assert entity["ENTITY_TYPE"] == "LimitedPartnership"
    
    def test_filter_by_fund_id(self):
        """Test filter by fund_id"""
        response = requests.get(f"{BASE_URL}/api/entities?fund_id=1&limit=50")
        assert response.status_code == 200
        data = response.json()
        for entity in data["entities"]:
            assert entity["FUND_ID"] == 1
    
    def test_entity_structure(self):
        """Test entity has expected fields"""
        response = requests.get(f"{BASE_URL}/api/entities?limit=1")
        assert response.status_code == 200
        data = response.json()
        entity = data["entities"][0]
        expected_fields = ["ENTITY_ID", "COMPANY_NAME", "JURISDICTION", "ENTITY_TYPE"]
        for field in expected_fields:
            assert field in entity


class TestEntityFiltersEndpoint:
    """Test GET /api/entities/filters endpoint"""
    
    def test_get_filters(self):
        """Test filters endpoint returns jurisdictions and entity_types"""
        response = requests.get(f"{BASE_URL}/api/entities/filters")
        assert response.status_code == 200
        data = response.json()
        assert "jurisdictions" in data
        assert "entity_types" in data
        assert isinstance(data["jurisdictions"], list)
        assert isinstance(data["entity_types"], list)
    
    def test_jurisdictions_not_empty(self):
        """Test jurisdictions list is not empty"""
        response = requests.get(f"{BASE_URL}/api/entities/filters")
        assert response.status_code == 200
        data = response.json()
        assert len(data["jurisdictions"]) > 0
        assert "United Kingdom of Great Britain and Northern Ireland" in data["jurisdictions"]
    
    def test_entity_types_not_empty(self):
        """Test entity_types list is not empty"""
        response = requests.get(f"{BASE_URL}/api/entities/filters")
        assert response.status_code == 200
        data = response.json()
        assert len(data["entity_types"]) > 0
        expected_types = ["LimitedCompany", "LimitedPartnership", "PublicLimitedCompany", "Trust"]
        for et in expected_types:
            assert et in data["entity_types"]


class TestEntityDetailEndpoint:
    """Test GET /api/entities/{entity_id} endpoint"""
    
    def test_get_entity_by_id(self):
        """Test get entity by valid ID"""
        response = requests.get(f"{BASE_URL}/api/entities/1")
        assert response.status_code == 200
        data = response.json()
        assert "entity" in data
        assert data["entity"]["ENTITY_ID"] == 1
    
    def test_entity_detail_fields(self):
        """Test entity detail has all expected fields"""
        response = requests.get(f"{BASE_URL}/api/entities/1")
        assert response.status_code == 200
        data = response.json()
        entity = data["entity"]
        expected_fields = ["ENTITY_ID", "COMPANY_NAME", "JURISDICTION", "ENTITY_TYPE", "FUND_ID", "ASSET_ID"]
        for field in expected_fields:
            assert field in entity
    
    def test_entity_with_symbologies(self):
        """Test entity with symbologies field"""
        response = requests.get(f"{BASE_URL}/api/entities/1")
        assert response.status_code == 200
        data = response.json()
        entity = data["entity"]
        assert "SYMBOLOGIES" in entity
        # Entity 1 has UK_COMPANIES_HOUSE symbology
        if entity["SYMBOLOGIES"]:
            assert isinstance(entity["SYMBOLOGIES"], dict)
    
    def test_get_nonexistent_entity(self):
        """Test get entity with invalid ID returns error"""
        response = requests.get(f"{BASE_URL}/api/entities/999999999")
        assert response.status_code == 200  # API returns 200 with error message
        data = response.json()
        assert "error" in data
        assert data["error"] == "Entity not found"


class TestFundTreeEndpoint:
    """Test GET /api/funds/{fund_id}/tree endpoint"""
    
    def test_get_fund_tree_structure(self):
        """Test fund tree returns nodes and edges"""
        response = requests.get(f"{BASE_URL}/api/funds/1/tree")
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "edges" in data
        assert "fund_name" in data
        assert isinstance(data["nodes"], list)
        assert isinstance(data["edges"], list)
    
    def test_fund_i_tree_node_count(self):
        """Test Fund I tree has 71 nodes"""
        response = requests.get(f"{BASE_URL}/api/funds/1/tree")
        assert response.status_code == 200
        data = response.json()
        assert len(data["nodes"]) == 71
    
    def test_fund_i_tree_edge_count(self):
        """Test Fund I tree has 75 edges"""
        response = requests.get(f"{BASE_URL}/api/funds/1/tree")
        assert response.status_code == 200
        data = response.json()
        assert len(data["edges"]) == 75
    
    def test_fund_i_fund_name(self):
        """Test Fund I tree returns correct fund_name"""
        response = requests.get(f"{BASE_URL}/api/funds/1/tree")
        assert response.status_code == 200
        data = response.json()
        assert data["fund_name"] == "Fund I"
    
    def test_node_structure(self):
        """Test node has expected structure"""
        response = requests.get(f"{BASE_URL}/api/funds/1/tree")
        assert response.status_code == 200
        data = response.json()
        node = data["nodes"][0]
        assert "id" in node
        assert "data" in node
        assert "type" in node
        assert node["type"] == "entityNode"
        # Check node data
        node_data = node["data"]
        assert "label" in node_data
        assert "entity_type" in node_data
        assert "jurisdiction" in node_data
        assert "is_top" in node_data
        assert "entity_id" in node_data
    
    def test_edge_structure(self):
        """Test edge has expected structure with ownership"""
        response = requests.get(f"{BASE_URL}/api/funds/1/tree")
        assert response.status_code == 200
        data = response.json()
        edge = data["edges"][0]
        assert "id" in edge
        assert "source" in edge
        assert "target" in edge
        assert "type" in edge
        assert "data" in edge
        assert edge["type"] == "ownershipEdge"
        # Check edge data
        edge_data = edge["data"]
        assert "ownership" in edge_data
        assert "relation_type" in edge_data
        assert "ownership_decimal" in edge_data
    
    def test_ownership_percentage_format(self):
        """Test ownership is formatted as percentage"""
        response = requests.get(f"{BASE_URL}/api/funds/1/tree")
        assert response.status_code == 200
        data = response.json()
        for edge in data["edges"]:
            ownership = edge["data"]["ownership"]
            assert "%" in ownership
    
    def test_relation_types(self):
        """Test relation types are EQUITY or GENERAL_PARTNER"""
        response = requests.get(f"{BASE_URL}/api/funds/1/tree")
        assert response.status_code == 200
        data = response.json()
        valid_types = ["EQUITY", "GENERAL_PARTNER"]
        for edge in data["edges"]:
            assert edge["data"]["relation_type"] in valid_types
    
    def test_top_of_structure_node_exists(self):
        """Test tree has at least one top-of-structure node"""
        response = requests.get(f"{BASE_URL}/api/funds/1/tree")
        assert response.status_code == 200
        data = response.json()
        top_nodes = [n for n in data["nodes"] if n["data"]["is_top"]]
        assert len(top_nodes) >= 1
    
    def test_invalid_fund_returns_empty_tree(self):
        """Test invalid fund_id returns empty tree"""
        response = requests.get(f"{BASE_URL}/api/funds/999999/tree")
        assert response.status_code == 200
        data = response.json()
        assert data["nodes"] == []
        assert data["edges"] == []
        assert data["fund_name"] == ""


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
