import pytest
from tests.mock_data import MOCK_TEXTS, MOCK_SKELETON

def test_cam_score_endpoint(client, mock_invoke_with_retry):
    """Verify that /cam-score returns a valid accessibility report."""
    response = client.post("/cam-score", json={"text_content": MOCK_TEXTS["academic"]["source"]})
    
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert "cam" in json_data
    assert "score" in json_data["cam"]
    assert json_data["cam"]["score"] == 85
    
    # Verify mock was called
    assert mock_invoke_with_retry.called

def test_simplify_text_endpoint(client, mock_invoke_with_retry):
    """Verify that /simplify returns simplified text chunks."""
    payload = {
        "text_chunks": [MOCK_TEXTS["legal"]["source"]]
    }
    response = client.post("/simplify", json=payload)
    
    assert response.status_code == 200
    json_data = response.json()
    assert "simplified_chunks" in json_data
    assert len(json_data["simplified_chunks"]) == 1
    assert json_data["simplified_chunks"][0] == "Simplified test text"

def test_analyze_focus_endpoint(client, mock_invoke_with_retry):
    """Verify that /analyze-focus isolates main content."""
    response = client.post("/analyze-focus", json={"html_skeleton": MOCK_SKELETON})
    
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert "selectors" in json_data
    assert "main_content_selector" in json_data["selectors"]
    assert json_data["selectors"]["main_content_selector"] == "article"

def test_tone_analyzer_endpoint(client, mock_invoke_with_retry):
    """Verify that /analyze-tone provides social subtext."""
    response = client.post("/analyze-tone", json={"text_content": MOCK_TEXTS["medical"]["source"]})
    
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert "analysis" in json_data
    assert json_data["analysis"]["primary_tone"] == "Neutral"
