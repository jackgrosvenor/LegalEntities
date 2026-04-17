"""
Backend API Tests for CSV Upload Feature
Tests: POST /api/upload endpoint for replacing dataset
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Path to original CSV files for testing
CSV_DIR = os.path.join(os.path.dirname(__file__), '..')
ENTITY_MASTER_PATH = os.path.join(CSV_DIR, 'entity_master.csv')
ENTITY_RELATIONS_PATH = os.path.join(CSV_DIR, 'entity_relations.csv')


class TestUploadEndpoint:
    """Test POST /api/upload endpoint"""
    
    def test_upload_valid_csv_files(self):
        """Test upload with valid CSV files returns success"""
        with open(ENTITY_MASTER_PATH, 'rb') as master, open(ENTITY_RELATIONS_PATH, 'rb') as relations:
            files = {
                'entity_master': ('entity_master.csv', master, 'text/csv'),
                'entity_relations': ('entity_relations.csv', relations, 'text/csv')
            }
            response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "entities_count" in data
        assert "relations_count" in data
        assert "funds_count" in data
        assert data["entities_count"] > 0
        assert data["relations_count"] > 0
        assert data["funds_count"] > 0
        print(f"Upload success: {data['entities_count']} entities, {data['relations_count']} relations, {data['funds_count']} funds")
    
    def test_upload_missing_entity_master(self):
        """Test upload without entity_master file returns error"""
        with open(ENTITY_RELATIONS_PATH, 'rb') as relations:
            files = {
                'entity_relations': ('entity_relations.csv', relations, 'text/csv')
            }
            response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        # FastAPI returns 422 for missing required file
        assert response.status_code == 422
    
    def test_upload_missing_entity_relations(self):
        """Test upload without entity_relations file returns error"""
        with open(ENTITY_MASTER_PATH, 'rb') as master:
            files = {
                'entity_master': ('entity_master.csv', master, 'text/csv')
            }
            response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        # FastAPI returns 422 for missing required file
        assert response.status_code == 422
    
    def test_upload_empty_entity_master(self):
        """Test upload with empty entity_master returns error"""
        import io
        empty_csv = io.BytesIO(b"")
        
        with open(ENTITY_RELATIONS_PATH, 'rb') as relations:
            files = {
                'entity_master': ('entity_master.csv', empty_csv, 'text/csv'),
                'entity_relations': ('entity_relations.csv', relations, 'text/csv')
            }
            response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert "error" in data
        print(f"Empty master error: {data['error']}")
    
    def test_upload_missing_required_columns_entity_master(self):
        """Test upload with entity_master missing required columns returns error"""
        import io
        # CSV without ENTITY_ID column
        invalid_csv = io.BytesIO(b"COMPANY_NAME,JURISDICTION\nTest Company,UK\n")
        
        with open(ENTITY_RELATIONS_PATH, 'rb') as relations:
            files = {
                'entity_master': ('entity_master.csv', invalid_csv, 'text/csv'),
                'entity_relations': ('entity_relations.csv', relations, 'text/csv')
            }
            response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert "error" in data
        assert "ENTITY_ID" in data["error"]
        print(f"Missing column error: {data['error']}")
    
    def test_upload_missing_required_columns_entity_relations(self):
        """Test upload with entity_relations missing required columns returns error"""
        import io
        # CSV without PARENT_ID column
        invalid_relations = io.BytesIO(b"CHILD_ID,RELATION_TYPE\n1,EQUITY\n")
        
        with open(ENTITY_MASTER_PATH, 'rb') as master:
            files = {
                'entity_master': ('entity_master.csv', master, 'text/csv'),
                'entity_relations': ('entity_relations.csv', invalid_relations, 'text/csv')
            }
            response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert "error" in data
        assert "PARENT_ID" in data["error"]
        print(f"Missing relation column error: {data['error']}")
    
    def test_upload_empty_entity_relations(self):
        """Test upload with empty entity_relations returns error"""
        import io
        empty_csv = io.BytesIO(b"")
        
        with open(ENTITY_MASTER_PATH, 'rb') as master:
            files = {
                'entity_master': ('entity_master.csv', master, 'text/csv'),
                'entity_relations': ('entity_relations.csv', empty_csv, 'text/csv')
            }
            response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert "error" in data
        print(f"Empty relations error: {data['error']}")


class TestUploadDataPersistence:
    """Test that uploaded data persists and is accessible via other endpoints"""
    
    def test_data_persists_after_upload(self):
        """Test that data is accessible after upload"""
        # First upload the data
        with open(ENTITY_MASTER_PATH, 'rb') as master, open(ENTITY_RELATIONS_PATH, 'rb') as relations:
            files = {
                'entity_master': ('entity_master.csv', master, 'text/csv'),
                'entity_relations': ('entity_relations.csv', relations, 'text/csv')
            }
            upload_response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert upload_response.status_code == 200
        upload_data = upload_response.json()
        assert upload_data["success"] == True
        
        # Verify entities are accessible
        entities_response = requests.get(f"{BASE_URL}/api/entities?limit=1")
        assert entities_response.status_code == 200
        entities_data = entities_response.json()
        assert entities_data["total"] == upload_data["entities_count"]
        
        # Verify funds are accessible
        funds_response = requests.get(f"{BASE_URL}/api/funds")
        assert funds_response.status_code == 200
        funds_data = funds_response.json()
        assert len(funds_data["funds"]) == upload_data["funds_count"]
        
        # Verify filters are accessible
        filters_response = requests.get(f"{BASE_URL}/api/entities/filters")
        assert filters_response.status_code == 200
        filters_data = filters_response.json()
        assert len(filters_data["jurisdictions"]) > 0
        assert len(filters_data["entity_types"]) > 0
        
        print(f"Data persistence verified: {entities_data['total']} entities, {len(funds_data['funds'])} funds")
    
    def test_fund_tree_works_after_upload(self):
        """Test that fund tree endpoint works after upload"""
        # First upload the data
        with open(ENTITY_MASTER_PATH, 'rb') as master, open(ENTITY_RELATIONS_PATH, 'rb') as relations:
            files = {
                'entity_master': ('entity_master.csv', master, 'text/csv'),
                'entity_relations': ('entity_relations.csv', relations, 'text/csv')
            }
            upload_response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert upload_response.status_code == 200
        
        # Get Fund I tree
        tree_response = requests.get(f"{BASE_URL}/api/funds/1/tree")
        assert tree_response.status_code == 200
        tree_data = tree_response.json()
        
        assert "nodes" in tree_data
        assert "edges" in tree_data
        assert len(tree_data["nodes"]) > 0
        assert len(tree_data["edges"]) > 0
        
        print(f"Fund tree verified: {len(tree_data['nodes'])} nodes, {len(tree_data['edges'])} edges")


class TestUploadWithMinimalValidData:
    """Test upload with minimal valid CSV data"""
    
    def test_upload_minimal_valid_data(self):
        """Test upload with minimal valid CSV data"""
        import io
        
        # Minimal valid entity master
        minimal_master = io.BytesIO(
            b"ENTITY_ID,COMPANY_NAME,FUND_ID,IS_TOP_OF_STRUCTURE\n"
            b"1,Test Company A,1,true\n"
            b"2,Test Company B,1,false\n"
        )
        
        # Minimal valid relations
        minimal_relations = io.BytesIO(
            b"PARENT_ID,CHILD_ID,EQUITIX_OWNERSHIP_DECIMAL,RELATION_TYPE\n"
            b"1,2,1.0,EQUITY\n"
        )
        
        files = {
            'entity_master': ('entity_master.csv', minimal_master, 'text/csv'),
            'entity_relations': ('entity_relations.csv', minimal_relations, 'text/csv')
        }
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["entities_count"] == 2
        assert data["relations_count"] == 1
        assert data["funds_count"] == 1
        print(f"Minimal upload success: {data}")
        
        # Verify the data is accessible
        entities_response = requests.get(f"{BASE_URL}/api/entities?limit=10")
        assert entities_response.status_code == 200
        entities_data = entities_response.json()
        assert entities_data["total"] == 2
        
        # Verify fund tree works
        tree_response = requests.get(f"{BASE_URL}/api/funds/1/tree")
        assert tree_response.status_code == 200
        tree_data = tree_response.json()
        assert len(tree_data["nodes"]) == 2
        assert len(tree_data["edges"]) == 1
        
        # Restore original data
        with open(ENTITY_MASTER_PATH, 'rb') as master, open(ENTITY_RELATIONS_PATH, 'rb') as relations:
            files = {
                'entity_master': ('entity_master.csv', master, 'text/csv'),
                'entity_relations': ('entity_relations.csv', relations, 'text/csv')
            }
            restore_response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert restore_response.status_code == 200
        assert restore_response.json()["success"] == True
        print("Original data restored")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
